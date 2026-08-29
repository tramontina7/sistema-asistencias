import db from '../db/index.js'
import { HttpError } from '../utils/http-error.js'
import { decrypt, encrypt } from '../utils/crypto.js'
import { formatNombre } from './cursoService.js'

function normalizar(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function vinculosDeTutor(tutorId) {
  return db.prepare(
    `SELECT at.alumno_id, a.nombre, a.apellido, c.anio, c.division, c.especialidad,
            at.parentesco, at.es_principal
     FROM alumnos_tutores at
     JOIN alumnos a ON a.alumno_id = at.alumno_id
     JOIN cursos c ON c.curso_id = a.curso_id
     WHERE at.tutor_id = ?
     ORDER BY a.apellido, a.nombre`
  ).all(tutorId).map(v => ({
    alumno_id: v.alumno_id,
    nombre: v.nombre,
    apellido: v.apellido,
    curso_nombre: `${formatNombre(v)} ${v.especialidad}`.trim(),
    parentesco: v.parentesco,
    es_principal: v.es_principal,
  }))
}

function toPublic(row) {
  if (!row) return null
  let dni = null
  try { dni = decrypt(row.dni_cif) } catch { dni = row.dni_cif }
  return {
    tutor_id: row.tutor_id,
    nombre: row.nombre,
    apellido: row.apellido,
    dni,
    telefono: row.telefono,
    vinculos: vinculosDeTutor(row.tutor_id),
  }
}

function validarVinculos(vinculos) {
  if (vinculos === undefined || vinculos === null) return []
  if (!Array.isArray(vinculos)) throw new HttpError(400, 'vinculos debe ser un arreglo')
  const vistos = new Set()
  return vinculos.map(v => {
    const alumnoId = Number(v.alumno_id)
    if (!alumnoId) throw new HttpError(400, 'Cada vínculo requiere alumno_id')
    if (vistos.has(alumnoId)) throw new HttpError(400, `El alumno ${alumnoId} está repetido en los vínculos`)
    vistos.add(alumnoId)
    const alumno = db.prepare('SELECT alumno_id FROM alumnos WHERE alumno_id = ?').get(alumnoId)
    if (!alumno) throw new HttpError(400, `El alumno ${alumnoId} no existe`)
    if (!v.parentesco) throw new HttpError(400, `Falta el parentesco del alumno ${alumnoId}`)
    return {
      alumno_id: alumnoId,
      parentesco: String(v.parentesco).trim(),
      es_principal: v.es_principal ? 1 : 0,
    }
  })
}

function setVinculos(tutorId, vinculos) {
  db.prepare('DELETE FROM alumnos_tutores WHERE tutor_id = ?').run(tutorId)
  const insert = db.prepare(
    'INSERT INTO alumnos_tutores (alumno_id, tutor_id, parentesco, es_principal) VALUES (?, ?, ?, ?)'
  )
  for (const v of vinculos) insert.run(v.alumno_id, tutorId, v.parentesco, v.es_principal)
}

export const tutorService = {
  validarTutorPorAlumno({ alumnoId, nombre, apellido, dni }) {
    if (!alumnoId) throw new HttpError(400, 'alumnoId requerido')
    if (!nombre || !apellido || !dni) {
      throw new HttpError(400, 'Debe completar Nombre, Apellido y DNI')
    }

    const alumno = db.prepare('SELECT alumno_id FROM alumnos WHERE alumno_id = ?').get(alumnoId)
    if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

    const objetivo = `${normalizar(nombre)} ${normalizar(apellido)}`
    const candidatos = db.prepare(
      `SELECT tutor_id, nombre, apellido, dni_cif FROM tutores`
    ).all()

    const tutor = candidatos.find(t => {
      const key = `${normalizar(t.nombre)} ${normalizar(t.apellido)}`
      let coincideDni = false
      try {
        coincideDni = decrypt(t.dni_cif) === String(dni).trim()
      } catch {
        coincideDni = t.dni_cif === String(dni).trim()
      }
      return key === objetivo && coincideDni
    })

    if (!tutor) throw new HttpError(404, 'Persona no Autorizada')

    const vinculo = db.prepare(
      'SELECT * FROM alumnos_tutores WHERE alumno_id = ? AND tutor_id = ?'
    ).get(alumnoId, tutor.tutor_id)

    if (!vinculo) throw new HttpError(404, 'Persona no Autorizada')

    return { tutor_id: tutor.tutor_id }
  },

  listarPorAlumno(alumnoId) {
    if (!alumnoId) throw new HttpError(400, 'alumno_id requerido')
    return db.prepare(
      `SELECT t.tutor_id, t.nombre, t.apellido, t.telefono, at.parentesco, at.es_principal
       FROM alumnos_tutores at
       JOIN tutores t ON t.tutor_id = at.tutor_id
       WHERE at.alumno_id = ?
       ORDER BY at.es_principal DESC, t.apellido, t.nombre`
    ).all(alumnoId)
  },

  list() {
    return db.prepare('SELECT * FROM tutores ORDER BY apellido, nombre').all().map(toPublic)
  },

  getById(tutorId) {
    const row = db.prepare('SELECT * FROM tutores WHERE tutor_id = ?').get(tutorId)
    if (!row) throw new HttpError(404, 'Tutor no encontrado')
    return toPublic(row)
  },

  create({ nombre, apellido, dni, telefono, vinculos }) {
    if (!nombre || !apellido || !dni) throw new HttpError(400, 'nombre, apellido y dni son requeridos')
    const existe = db.prepare('SELECT dni_cif FROM tutores WHERE dni_cif IS NOT NULL').all()
      .some(t => {
        try { return decrypt(t.dni_cif) === dni.trim() } catch { return t.dni_cif === dni.trim() }
      })
    if (existe) throw new HttpError(409, 'Ya existe un tutor con ese DNI')

    const conVinculos = validarVinculos(vinculos)
    const nombreM = String(nombre).trim()
    const apellidoM = String(apellido).trim()
    const dniM = String(dni).trim()

    const result = db.prepare(
      'INSERT INTO tutores (nombre, apellido, dni_hash, dni_cif, telefono) VALUES (?, ?, ?, ?, ?)'
    ).run(nombreM, apellidoM, encrypt(dniM), encrypt(dniM), telefono || '')

    const tutorId = result.lastInsertRowid
    setVinculos(tutorId, conVinculos)
    return this.getById(tutorId)
  },

  update(tutorId, { nombre, apellido, dni, telefono, vinculos }) {
    const existente = this.getById(tutorId)

    if (dni && dni.trim() !== existente.dni) {
      const dup = db.prepare('SELECT dni_cif FROM tutores WHERE tutor_id != ?').all(tutorId)
        .some(t => {
          try { return decrypt(t.dni_cif) === dni.trim() } catch { return t.dni_cif === dni.trim() }
        })
      if (dup) throw new HttpError(409, 'Ya existe un tutor con ese DNI')
    }

    const nombreN = nombre !== undefined ? String(nombre).trim() : existente.nombre
    const apellidoN = apellido !== undefined ? String(apellido).trim() : existente.apellido
    const telefonoN = telefono !== undefined ? String(telefono).trim() : existente.telefono
    const dniN = dni !== undefined ? dni.trim() : existente.dni

    db.prepare(
      `UPDATE tutores SET nombre = ?, apellido = ?, dni_hash = ?, dni_cif = ?, telefono = ? WHERE tutor_id = ?`
    ).run(nombreN, apellidoN, encrypt(dniN), encrypt(dniN), telefonoN, tutorId)

    const conVinculos = validarVinculos(vinculos)
    setVinculos(tutorId, conVinculos)

    return this.getById(tutorId)
  },

  remove(tutorId) {
    const existente = db.prepare('SELECT tutor_id FROM tutores WHERE tutor_id = ?').get(tutorId)
    if (!existente) throw new HttpError(404, 'Tutor no encontrado')
    const conRetiros = db.prepare('SELECT COUNT(*) c FROM retiros WHERE tutor_id = ?').get(tutorId).c
    if (conRetiros > 0) {
      throw new HttpError(409, 'No se puede eliminar: el tutor tiene retiros registrados')
    }
    db.prepare('DELETE FROM tutores WHERE tutor_id = ?').run(tutorId)
    return { mensaje: 'Tutor eliminado' }
  },
}
