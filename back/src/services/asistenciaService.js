import db from '../db/index.js'
import { horaLocal, diaSemanaLocal } from '../utils/fecha.js'
import { HttpError } from '../utils/http-error.js'

const ESTADOS_MANUALES = ['Presente', 'Ausente', 'Tarde']

export const asistenciaService = {
  ESTADOS_MANUALES,

  tomar({ materiaId, fecha, asistencias }) {
    if (!materiaId || !fecha || !Array.isArray(asistencias) || asistencias.length === 0) {
      throw new HttpError(400, 'materia_id, fecha y asistencias requeridos')
    }

    const materia = db.prepare('SELECT materia_id FROM materias WHERE materia_id = ?').get(materiaId)
    if (!materia) throw new HttpError(404, 'Materia no encontrada')

    const porAlumno = new Map()
    for (const a of asistencias) {
      if (!a.alumno_id) throw new HttpError(400, 'Cada asistencia debe incluir alumno_id')
      if (!ESTADOS_MANUALES.includes(a.estado)) {
        throw new HttpError(400, `Estado no permitido: ${a.estado}`)
      }
      porAlumno.set(a.alumno_id, a.estado)
    }

    const upsert = db.prepare(
      `INSERT INTO asistencias (alumno_id, materia_id, fecha, estado)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(alumno_id, materia_id, fecha) DO UPDATE
         SET estado = excluded.estado`
    )

    const tx = db.transaction(() => {
      for (const [alumnoId, estado] of porAlumno) {
        upsert.run(alumnoId, materiaId, fecha, estado)
      }
    })
    tx()
  },

  list({ materiaId, fecha }) {
    if (!materiaId || !fecha) throw new HttpError(400, 'materia_id y fecha requeridos')

    return db.prepare(
      `SELECT a.asistencia_id, a.alumno_id, a.estado, a.fecha, a.motivo,
              al.nombre, al.apellido
       FROM asistencias a
       JOIN alumnos al ON al.alumno_id = a.alumno_id
       WHERE a.materia_id = ? AND a.fecha = ?
       ORDER BY al.apellido, al.nombre`
    ).all(materiaId, fecha)
  },

  updateEstado(asistenciaId, { estado, motivo }) {
    const updMotivo = estado === 'Justificado' ? (motivo || null) : null
    db.prepare(
      'UPDATE asistencias SET estado = ?, motivo = ? WHERE asistencia_id = ?'
    ).run(estado, updMotivo, asistenciaId)
  },

  materiaDelMomento({ cursoId, ahora }) {
    const now = ahora || new Date()
    const dia = diaSemanaLocal(now)
    const hora = horaLocal(now)

    const materiasDia = db.prepare(
      `SELECT m.materia_id, m.nombre_materia, h.hora_entrada, h.hora_salida
       FROM materias m
       JOIN horarios h ON h.materia_id = m.materia_id
       WHERE m.curso_id = ? AND h.dia_semana = ?
       ORDER BY h.hora_entrada, m.materia_id`
    ).all(cursoId, dia)

    if (materiasDia.length === 0) {
      throw new HttpError(400, 'El alumno no cursa ninguna materia en este horario')
    }

    const match = materiasDia.find(
      m => m.hora_entrada <= hora && hora <= m.hora_salida
    ) || materiasDia[0]

    return { materia_id: match.materia_id, nombre_materia: match.nombre_materia }
  },

  registrarQr({ alumnoId, materiaId, fecha, ahora }) {
    const now = ahora || new Date()
    const alumno = db.prepare(
      'SELECT alumno_id FROM alumnos WHERE alumno_id = ?'
    ).get(alumnoId)
    if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

    const materia = db.prepare('SELECT materia_id FROM materias WHERE materia_id = ?').get(materiaId)
    if (!materia) throw new HttpError(404, 'Materia no encontrada')

    const p = (n) => String(n).padStart(2, '0')
    const horaLograda = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`

    db.prepare(
      `INSERT INTO asistencias (alumno_id, materia_id, fecha, estado, motivo)
       VALUES (?, ?, ?, 'Tarde', ?)
       ON CONFLICT(alumno_id, materia_id, fecha) DO UPDATE
         SET estado = excluded.estado, motivo = excluded.motivo`
    ).run(alumnoId, materiaId, fecha, `QR escaneado a las ${horaLograda}`)

    return { estado: 'Tarde', hora: horaLograda }
  },
}
