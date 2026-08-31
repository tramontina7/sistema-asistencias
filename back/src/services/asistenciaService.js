import db from '../db/index.js'
import { horaLocal, diaSemanaLocal } from '../utils/fecha.js'
import { HttpError } from '../utils/http-error.js'

const ESTADOS_MANUALES = ['Presente', 'Ausente', 'Tarde']

function horaMarcada(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

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
      const esTarde = a.estado === 'Tarde'
      const horaIngreso = esTarde ? horaMarcada() : null
      const motivoTarde = esTarde ? (a.motivo || null) : null
      porAlumno.set(a.alumno_id, { estado: a.estado, horaIngreso, motivoTarde })
    }

    // Al marcar Tarde se registra la hora de llegada y un motivo opcional.
    // Al pasar a un estado que no es Tarde se CONSERVA la hora y el motivo de
    // la llegada tarde (la información de la asistencia original no se pierde).
    const upsert = db.prepare(
      `INSERT INTO asistencias (alumno_id, materia_id, fecha, estado, hora_ingreso, motivo_tarde)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(alumno_id, materia_id, fecha) DO UPDATE
         SET estado = excluded.estado,
             hora_ingreso = CASE
               WHEN excluded.estado = 'Tarde' THEN excluded.hora_ingreso
               ELSE hora_ingreso
             END,
             motivo_tarde = CASE
               WHEN excluded.estado = 'Tarde' THEN COALESCE(excluded.motivo_tarde, motivo_tarde)
               ELSE motivo_tarde
             END`
    )

    const tx = db.transaction(() => {
      for (const [alumnoId, { estado, horaIngreso, motivoTarde }] of porAlumno) {
        upsert.run(alumnoId, materiaId, fecha, estado, horaIngreso, motivoTarde)
      }
    })
    tx()
  },

  list({ materiaId, fecha }) {
    if (!materiaId || !fecha) throw new HttpError(400, 'materia_id y fecha requeridos')

    return db.prepare(
      `SELECT a.asistencia_id, a.alumno_id, a.estado, a.fecha, a.motivo, a.hora_ingreso, a.motivo_tarde,
              al.nombre, al.apellido
       FROM asistencias a
       JOIN alumnos al ON al.alumno_id = a.alumno_id
       WHERE a.materia_id = ? AND a.fecha = ?
       ORDER BY al.apellido, al.nombre`
    ).all(materiaId, fecha)
  },

  updateEstado(asistenciaId, { estado, motivo, horaIngreso, motivoTarde }) {
    const actual = db.prepare('SELECT * FROM asistencias WHERE asistencia_id = ?').get(asistenciaId)

    let nuevoEstado = estado
    let nuevoMotivo = actual ? actual.motivo : null
    let nuevaHora = actual ? actual.hora_ingreso : null
    let nuevoMotivoTarde = actual ? actual.motivo_tarde : null

    if (estado === 'Tarde') {
      // Se registra la hora actual si no se provee una, y el motivo opcional.
      nuevaHora = horaIngreso || horaMarcada()
      nuevoMotivoTarde = motivoTarde !== undefined ? (motivoTarde || null) : (actual?.motivo_tarde ?? null)
      nuevoMotivo = null
    } else if (estado === 'Justificado') {
      nuevoMotivo = motivo || null
      // Se conservan hora_ingreso y motivo_tarde de la llegada si los hubiera.
    } else {
      // Presente / Ausente: se conservan hora_ingreso y motivo_tarde.
      nuevoMotivo = null
    }

    db.prepare(
      'UPDATE asistencias SET estado = ?, motivo = ?, hora_ingreso = ?, motivo_tarde = ? WHERE asistencia_id = ?'
    ).run(nuevoEstado, nuevoMotivo, nuevaHora, nuevoMotivoTarde, asistenciaId)
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
      // Fallback temporal (modo prueba): si el día no tiene horarios (p.ej. sábado),
      // se toma la primera materia del curso.
      const cualquier = db.prepare(
        `SELECT m.materia_id, m.nombre_materia
         FROM materias m
         WHERE m.curso_id = ?
         ORDER BY m.materia_id
         LIMIT 1`
      ).get(cursoId)
      if (!cualquier) {
        throw new HttpError(400, 'El alumno no cursa ninguna materia')
      }
      return { materia_id: cualquier.materia_id, nombre_materia: cualquier.nombre_materia }
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

    const horaLograda = horaMarcada(now)

    db.prepare(
      `INSERT INTO asistencias (alumno_id, materia_id, fecha, estado, motivo, hora_ingreso)
       VALUES (?, ?, ?, 'Tarde', ?, ?)
       ON CONFLICT(alumno_id, materia_id, fecha) DO UPDATE
         SET estado = excluded.estado, motivo = excluded.motivo, hora_ingreso = excluded.hora_ingreso`
    ).run(alumnoId, materiaId, fecha, `QR escaneado a las ${horaLograda}`, horaLograda)

    return { estado: 'Tarde', hora: horaLograda }
  },
}
