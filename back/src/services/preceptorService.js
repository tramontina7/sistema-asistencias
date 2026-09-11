import bcrypt from 'bcryptjs'
import db from '../db/index.js'
import { encrypt } from '../utils/crypto.js'
import { HttpError } from '../utils/http-error.js'

const TURNOS_VALIDOS = ['Mañana', 'Tarde', 'Noche']

function validarTurno(turno, { permitirVacio } = {}) {
  if (turno == null || turno === '') {
    return null
  }
  if (!TURNOS_VALIDOS.includes(turno)) {
    throw new HttpError(400, `Turno inválido (valores: ${TURNOS_VALIDOS.join(', ')} o vacío)`)
  }
  return turno
}

function validarCamposObligatorios({ username, password, nombre, apellido, dni, telefono }) {
  for (const [campo, valor] of Object.entries({ username, password, nombre, apellido, dni, telefono })) {
    if (!valor) {
      throw new HttpError(400, `Se requiere ${campo}`)
    }
  }
}

function formatoPublico(row) {
  if (!row) return null
  const { dni_hash, dni_cif, password_hash, ...rest } = row
  return rest
}

// Inserta/actualiza preceptores de forma idempotente por username.
// Con SEED_DEMO=false y SEED_PRECEPTORES se usan credenciales reales sin demo.
export async function asegurarPreceptores(lista) {
  for (const u of lista) {
    if (!u.username || !u.password || !u.nombre || !u.apellido || !u.telefono) {
      throw new Error('[seed] Cada preceptor debe incluir username, password, nombre, apellido y telefono')
    }
    if (!u.dni) {
      throw new Error('[seed] Cada preceptor debe incluir un dni numérico')
    }
  }
  const hashes = {}
  for (const u of lista) {
    if (!(u.password in hashes)) {
      hashes[u.password] = await bcrypt.hash(u.password, 12)
    }
  }
  const tx = db.transaction(() => {
    const insert = db.prepare(
      `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash, turno)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const updateTurno = db.prepare('UPDATE preceptores SET turno = ? WHERE username = ?')
    for (const u of lista) {
      const existente = db.prepare('SELECT preceptor_id, turno FROM preceptores WHERE username = ?').get(u.username)
      if (existente) {
        if (existente.turno !== u.turno) updateTurno.run(u.turno, u.username)
      } else {
        insert.run(u.nombre, u.apellido, encrypt(u.dni), encrypt(u.dni), u.telefono, u.username, hashes[u.password], u.turno)
      }
    }
  })
  tx()
}

// Devuelve el preceptor buscado por id o username (con credenciales internas).
function buscarPorIdUsername(id, username) {
  if (id !== undefined) {
    return db.prepare(
      'SELECT preceptor_id, nombre, apellido, dni_cif, telefono, username, turno, activo FROM preceptores WHERE preceptor_id = ?'
    ).get(id)
  }
  if (username !== undefined) {
    return db.prepare(
      'SELECT preceptor_id, nombre, apellido, dni_cif, telefono, username, turno, activo FROM preceptores WHERE username = ?'
    ).get(username)
  }
  return null
}

export const preceptorService = {
  list() {
    const rows = db.prepare(
      `SELECT preceptor_id, nombre, apellido, telefono, username, turno, activo
       FROM preceptores ORDER BY activo DESC, apellido, nombre`
    ).all()
    return rows.map(formatoPublico)
  },

  getById(preceptorId) {
    const row = db.prepare(
      `SELECT preceptor_id, nombre, apellido, telefono, username, turno, activo
       FROM preceptores WHERE preceptor_id = ?`
    ).get(preceptorId)
    return formatoPublico(row)
  },

  create({ username, password, nombre, apellido, dni, telefono, turno }) {
    validarCamposObligatorios({ username, password, nombre, apellido, dni, telefono })
    const turnoOk = validarTurno(turno)

    const existente = db.prepare('SELECT preceptor_id FROM preceptores WHERE username = ?').get(username)
    if (existente) throw new HttpError(409, `Ya existe un preceptor con el username '${username}'`)

    const dniText = String(dni)
    const passwordHash = bcrypt.hashSync(password, 12)
    const result = db.prepare(
      `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash, turno, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(nombre, apellido, encrypt(dniText), encrypt(dniText), telefono, username, passwordHash, turnoOk, 1)

    return this.getById(result.lastInsertRowid)
  },

  update(identificador, { nombre, apellido, dni, telefono, turno, password }) {
    const where = typeof identificador === 'number' ? 'preceptor_id = ?' : 'username = ?'
    const exists = db.prepare(`SELECT preceptor_id FROM preceptores WHERE ${where}`).get(identificador)
    if (!exists) throw new HttpError(404, 'Preceptor no encontrado')

    const updates = []
    const params = []
    if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre) }
    if (apellido !== undefined) { updates.push('apellido = ?'); params.push(apellido) }
    if (telefono !== undefined) { updates.push('telefono = ?'); params.push(telefono) }
    if (dni !== undefined) {
      updates.push('dni_hash = ?', 'dni_cif = ?')
      const dniText = String(dni)
      params.push(encrypt(dniText), encrypt(dniText))
    }
    if (turno !== undefined) {
      updates.push('turno = ?')
      params.push(validarTurno(turno))
    }
    if (password !== undefined && password !== '') {
      updates.push('password_hash = ?')
      params.push(bcrypt.hashSync(password, 12))
    }

    if (updates.length === 0) throw new HttpError(400, 'No hay campos para actualizar')

    params.push(identificador)
    db.prepare(`UPDATE preceptores SET ${updates.join(', ')} WHERE ${where}`).run(...params)

    return db.prepare(
      `SELECT preceptor_id, nombre, apellido, telefono, username, turno, activo
       FROM preceptores WHERE ${where}`
    ).get(identificador)
  },

  setActivo(identificador, activo) {
    const where = typeof identificador === 'number' ? 'preceptor_id = ?' : 'username = ?'
    const row = db.prepare(`SELECT activo FROM preceptores WHERE ${where}`).get(identificador)
    if (!row) throw new HttpError(404, 'Preceptor no encontrado')

    if (!activo) {
      const activos = db.prepare('SELECT COUNT(*) AS c FROM preceptores WHERE activo = 1').get().c
      if (activos <= 1 && row.activo === 1) {
        throw new HttpError(400, 'No se puede desactivar al último preceptor activo')
      }
    }

    db.prepare(`UPDATE preceptores SET activo = ? WHERE ${where}`).run(activo ? 1 : 0, identificador)

    return db.prepare(
      `SELECT preceptor_id, nombre, apellido, telefono, username, turno, activo
       FROM preceptores WHERE ${where}`
    ).get(identificador)
  },

  remove(identificador) {
    const where = typeof identificador === 'number' ? 'preceptor_id = ?' : 'username = ?'
    const row = db.prepare(
      `SELECT preceptor_id, nombre, apellido, telefono, username, turno, activo
       FROM preceptores WHERE ${where}`
    ).get(identificador)
    if (!row) throw new HttpError(404, 'Preceptor no encontrado')

    if (row.activo === 1) {
      const activos = db.prepare('SELECT COUNT(*) AS c FROM preceptores WHERE activo = 1').get().c
      if (activos <= 1) {
        throw new HttpError(400, 'No se puede eliminar al último preceptor activo')
      }
    }

    db.prepare(`DELETE FROM preceptores WHERE ${where}`).run(identificador)
    return row
  },
}
