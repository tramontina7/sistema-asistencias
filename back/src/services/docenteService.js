import db from '../db/index.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import { HttpError } from '../utils/http-error.js'

const ESTADOS_DOCENTE = ['Disponible', 'Licencia']

const BASE_SELECT =
  'SELECT docente_id, nombre, apellido, dni_cif, correo, telefono, estado FROM docentes'

function toPublic(row) {
  if (!row) return null
  const puedeDictar = db.prepare(
    'SELECT nombre_materia FROM docente_materias WHERE docente_id = ? ORDER BY nombre_materia'
  ).all(row.docente_id).map(r => r.nombre_materia)
  return { ...row, dni: row.dni_cif ? decrypt(row.dni_cif) : null, dni_cif: undefined, puede_dictar: puedeDictar }
}

function validarMaterias(nombres) {
  if (!Array.isArray(nombres)) throw new HttpError(400, 'puede_dictar debe ser un arreglo')
  const validos = new Set(
    db.prepare('SELECT DISTINCT nombre_materia FROM materias').all().map(r => r.nombre_materia)
  )
  for (const n of nombres) {
    if (!validos.has(n)) throw new HttpError(400, `La materia '${n}' no existe en el catálogo`)
  }
}

function setCompetencias(docenteId, nombres) {
  db.prepare('DELETE FROM docente_materias WHERE docente_id = ?').run(docenteId)
  const insert = db.prepare(
    'INSERT INTO docente_materias (docente_id, nombre_materia) VALUES (?, ?)'
  )
  for (const n of nombres) insert.run(docenteId, n)
}

function validarEstado(estado) {
  if (!ESTADOS_DOCENTE.includes(estado)) {
    throw new HttpError(400, `Estado inválido (valores: ${ESTADOS_DOCENTE.join(', ')})`)
  }
}

function docentesDisponibles(nombreMateria) {
  return db.prepare(
    `SELECT d.docente_id, d.nombre, d.apellido
     FROM docente_materias dm
     JOIN docentes d ON d.docente_id = dm.docente_id
     WHERE dm.nombre_materia = ?
     ORDER BY d.apellido, d.nombre`
  ).all(nombreMateria)
}

export const docenteService = {
  list() {
    return db.prepare(`${BASE_SELECT} ORDER BY apellido, nombre`).all().map(toPublic)
  },

  getById(docenteId) {
    const row = db.prepare(`${BASE_SELECT} WHERE docente_id = ?`).get(docenteId)
    if (!row) throw new HttpError(404, 'Docente no encontrado')
    return toPublic(row)
  },

  create({ nombre, apellido, dni, correo, telefono, puedeDictar, estado }) {
    if (!nombre || !apellido || !dni) {
      throw new HttpError(400, 'nombre, apellido y dni son requeridos')
    }
    if (correo && !correo.includes('@')) throw new HttpError(400, 'Correo inválido')
    if (puedeDictar !== undefined) validarMaterias(puedeDictar)
    const estadoFinal = estado !== undefined ? estado : 'Disponible'
    validarEstado(estadoFinal)

    const dniText = dni.toString()
    const duplicate = db.prepare('SELECT dni_cif FROM docentes').all()
      .some(r => r.dni_cif && decrypt(r.dni_cif) === dniText)
    if (duplicate) throw new HttpError(409, 'Ya existe un docente con ese DNI')

    const result = db.prepare(
      `INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, correo, telefono, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(nombre, apellido, encrypt(dniText), encrypt(dniText), correo || null, telefono || '', estadoFinal)

    const id = result.lastInsertRowid
    if (puedeDictar !== undefined) setCompetencias(id, puedeDictar)

    return {
      docente_id: id,
      nombre,
      apellido,
      dni: dniText,
      correo: correo || null,
      telefono: telefono || '',
      estado: estadoFinal,
      puede_dictar: (puedeDictar || []).sort(),
    }
  },

  update(docenteId, { nombre, apellido, dni, correo, telefono, puedeDictar, estado }) {
    const existing = db.prepare('SELECT docente_id FROM docentes WHERE docente_id = ?').get(docenteId)
    if (!existing) throw new HttpError(404, 'Docente no encontrado')
    if (correo !== undefined && correo && !correo.includes('@')) throw new HttpError(400, 'Correo inválido')
    if (puedeDictar !== undefined) validarMaterias(puedeDictar)

    const updates = []
    const params = []
    if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre) }
    if (apellido !== undefined) { updates.push('apellido = ?'); params.push(apellido) }
    if (dni !== undefined) {
      const dniText = dni.toString()
      updates.push('dni_hash = ?', 'dni_cif = ?')
      params.push(encrypt(dniText), encrypt(dniText))
    }
    if (correo !== undefined) { updates.push('correo = ?'); params.push(correo || null) }
    if (telefono !== undefined) { updates.push('telefono = ?'); params.push(telefono || '') }
    if (estado !== undefined) {
      validarEstado(estado)
      updates.push('estado = ?'); params.push(estado)
    }

    if (updates.length > 0) {
      params.push(docenteId)
      db.prepare(`UPDATE docentes SET ${updates.join(', ')} WHERE docente_id = ?`).run(...params)
    }
    if (puedeDictar !== undefined) setCompetencias(docenteId, puedeDictar)

    return this.getById(docenteId)
  },

  remove(docenteId) {
    const result = db.prepare('DELETE FROM docentes WHERE docente_id = ?').run(docenteId)
    if (result.changes === 0) throw new HttpError(404, 'Docente no encontrado')
  },

  materias(docenteId) {
    this.getById(docenteId)
    const comoTitular = db.prepare(
      `SELECT m.materia_id, m.nombre_materia, m.especialidad, m.curso_id,
              c.anio, c.division, NULL as comision
       FROM materias m
       JOIN cursos c ON c.curso_id = m.curso_id
       WHERE m.docente_id = ?
       ORDER BY c.anio, m.nombre_materia`
    ).all(docenteId)
    const porComision = db.prepare(
      `SELECT m.materia_id, m.nombre_materia, m.especialidad, m.curso_id,
              c.anio, c.division, mc.comision
       FROM materia_comisiones mc
       JOIN materias m ON m.materia_id = mc.materia_id
       JOIN cursos c ON c.curso_id = m.curso_id
       WHERE mc.docente_id = ?
       ORDER BY c.anio, m.nombre_materia, mc.comision`
    ).all(docenteId)
    return [...comoTitular, ...porComision]
  },

  cambiarEstado(docenteId, estado) {
    this.getById(docenteId)
    validarEstado(estado)

    db.prepare('UPDATE docentes SET estado = ? WHERE docente_id = ?').run(estado, docenteId)

    if (estado === 'Disponible') {
      db.prepare(
        `DELETE FROM docente_suplencias
         WHERE comision IS NULL AND materia_id IN (SELECT materia_id FROM materias WHERE docente_id = ?)`
      ).run(docenteId)
      db.prepare(
        `DELETE FROM docente_suplencias
         WHERE (materia_id, comision) IN (SELECT materia_id, comision FROM materia_comisiones WHERE docente_id = ?)`
      ).run(docenteId)
    }

    return this.getById(docenteId)
  },

  disponibilidad() {
    const docentes = db.prepare(
      'SELECT docente_id, nombre, apellido, estado FROM docentes ORDER BY apellido, nombre'
    ).all()

    const reemplazos = new Map(
      db.prepare(
        'SELECT materia_id, comision, suplente_docente_id FROM docente_suplencias'
      ).all().map(r => [`${r.materia_id}|${r.comision ?? ''}`, r.suplente_docente_id])
    )

    const cargos = []
    for (const m of db.prepare(
      `SELECT m.materia_id, m.nombre_materia, m.docente_id, c.anio, c.division
       FROM materias m
       JOIN cursos c ON c.curso_id = m.curso_id
       ORDER BY m.nombre_materia`
    ).all()) {
      cargos.push({
        materia_id: m.materia_id,
        nombre_materia: m.nombre_materia,
        anio: m.anio,
        division: m.division,
        comision: null,
        titular: m.docente_id,
      })
    }
    for (const mc of db.prepare(
      `SELECT mc.materia_id, mc.comision, mc.docente_id, m.nombre_materia, c.anio, c.division
       FROM materia_comisiones mc
       JOIN materias m ON m.materia_id = mc.materia_id
       JOIN cursos c ON c.curso_id = m.curso_id
       ORDER BY m.nombre_materia, mc.comision`
    ).all()) {
      cargos.push({
        materia_id: mc.materia_id,
        nombre_materia: mc.nombre_materia,
        anio: mc.anio,
        division: mc.division,
        comision: mc.comision,
        titular: mc.docente_id,
      })
    }

    return docentes.map(d => ({
      ...d,
      materias: cargos
        .filter(m => m.titular && Number(m.titular) === Number(d.docente_id))
        .map(m => {
          const reemplazoId = reemplazos.get(`${m.materia_id}|${m.comision ?? ''}`)
          const reemplazo = reemplazoId
            ? db.prepare(
              'SELECT docente_id, nombre, apellido FROM docentes WHERE docente_id = ?'
            ).get(reemplazoId)
            : null
          return {
            materia_id: m.materia_id,
            nombre_materia: m.nombre_materia,
            anio: m.anio,
            division: m.division,
            comision: m.comision,
            reemplazo,
            candidatos: d.estado === 'Licencia'
              ? docentesDisponibles(m.nombre_materia)
                .filter(c => c.docente_id !== d.docente_id)
              : [],
          }
        }),
    }))
  },

  asignarReemplazo(materiaId, suplenteId, comision) {
    const materia = db.prepare(
      'SELECT materia_id, nombre_materia, docente_id FROM materias WHERE materia_id = ?'
    ).get(materiaId)
    if (!materia) throw new HttpError(404, 'Materia no encontrada')

    const comisionFinal = comision || null
    let titular
    if (comisionFinal) {
      const fila = db.prepare(
        'SELECT docente_id FROM materia_comisiones WHERE materia_id = ? AND comision = ?'
      ).get(materiaId, comisionFinal)
      if (!fila) throw new HttpError(400, 'La materia no tiene esa comisión')
      titular = db.prepare(
        'SELECT docente_id, estado FROM docentes WHERE docente_id = ?'
      ).get(fila.docente_id)
      if (!titular) throw new HttpError(400, `La comisión '${comisionFinal}' no tiene docente titular asignado`)
    } else {
      titular = db.prepare(
        'SELECT docente_id, estado FROM docentes WHERE docente_id = ?'
      ).get(materia.docente_id)
      if (!titular) throw new HttpError(400, 'La materia no tiene docente titular asignado')
    }

    const suplente = db.prepare('SELECT docente_id FROM docentes WHERE docente_id = ?').get(suplenteId)
    if (!suplente) throw new HttpError(404, 'Docente suplente no encontrado')
    if (Number(suplenteId) === Number(titular.docente_id)) {
      throw new HttpError(400, 'El suplente no puede ser el docente titular')
    }
    if (titular.estado !== 'Licencia') {
      throw new HttpError(400, 'Solo se puede asignar suplente cuando el titular está de licencia')
    }

    const habil = db.prepare(
      'SELECT 1 FROM docente_materias WHERE docente_id = ? AND nombre_materia = ?'
    ).get(suplenteId, materia.nombre_materia)
    if (!habil) throw new HttpError(400, 'El docente no puede dictar esta materia')

    db.prepare(
      `INSERT INTO docente_suplencias (materia_id, comision, suplente_docente_id) VALUES (?, ?, ?)
       ON CONFLICT(materia_id, comision) DO UPDATE SET suplente_docente_id = excluded.suplente_docente_id`
    ).run(materiaId, comisionFinal, suplenteId)

    return { materia_id: Number(materiaId), comision: comisionFinal, suplente_id: Number(suplenteId) }
  },

  quitarReemplazo(materiaId, comision) {
    const comisionFinal = comision || null
    const result = db.prepare(
      'DELETE FROM docente_suplencias WHERE materia_id = ? AND comision IS ?'
    ).run(materiaId, comisionFinal)
    if (result.changes === 0) throw new HttpError(404, 'La materia no tiene suplente asignado')
    return { mensaje: 'Suplente quitado' }
  },
}