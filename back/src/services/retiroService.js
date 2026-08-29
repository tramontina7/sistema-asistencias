import db from '../db/index.js'
import { HttpError } from '../utils/http-error.js'
import { formatNombre } from './cursoService.js'

const ESTADOS_PRESENTE = ['Presente', 'Tarde']

function validarFecha(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new HttpError(400, 'Formato de fecha inválido (YYYY-MM-DD)')
}

export const retiroService = {
  listarPresentesPorCurso({ cursoId, fecha }) {
    if (!cursoId) throw new HttpError(400, 'curso_id requerido')
    if (!fecha) throw new HttpError(400, 'fecha requerida')
    validarFecha(fecha)

    const curso = db.prepare('SELECT curso_id FROM cursos WHERE curso_id = ?').get(cursoId)
    if (!curso) throw new HttpError(404, 'Curso no encontrado')

    const rows = db.prepare(
      `SELECT a.alumno_id, a.nombre, a.apellido, a.comision,
              c.anio, c.division, c.especialidad
       FROM alumnos a
       JOIN cursos c ON c.curso_id = a.curso_id
       JOIN asistencias asis ON asis.alumno_id = a.alumno_id
       WHERE a.curso_id = ?
         AND asis.fecha = ?
         AND asis.estado IN (${ESTADOS_PRESENTE.map(() => '?').join(',')})
       GROUP BY a.alumno_id
       ORDER BY a.apellido, a.nombre`
    ).all(cursoId, fecha, ...ESTADOS_PRESENTE)

    return rows.map(r => ({
      alumno_id: r.alumno_id,
      nombre: r.nombre,
      apellido: r.apellido,
      comision: r.comision,
      curso_nombre: `${formatNombre(r)} ${r.especialidad}`.trim(),
    }))
  },

  registrar({ alumnoId, tutorId, fecha, hora }) {
    if (!alumnoId || !tutorId) throw new HttpError(400, 'alumnoId y tutorId requeridos')
    if (!fecha) throw new HttpError(400, 'fecha requerida')
    validarFecha(fecha)

    const alumno = db.prepare('SELECT alumno_id FROM alumnos WHERE alumno_id = ?').get(alumnoId)
    if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

    const tutor = db.prepare('SELECT tutor_id FROM tutores WHERE tutor_id = ?').get(tutorId)
    if (!tutor) throw new HttpError(404, 'Tutor no encontrado')

    const info = db.prepare(
      'INSERT INTO retiros (alumno_id, tutor_id, fecha, hora) VALUES (?, ?, ?, ?)'
    ).run(alumnoId, tutorId, fecha, hora || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))

    return { retiro_id: info.lastInsertRowid, alumno_id: alumnoId, tutor_id: tutorId, fecha, hora }
  },
}
