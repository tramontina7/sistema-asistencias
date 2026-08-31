import db from '../db/index.js'

function parseDate(fecha) {
  const [y, m, d] = fecha.split('-').map(Number)
  return { y, m, d }
}

const fmt = (dt) => {
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function buildDateRange(tipo, fecha, cuatrimestre) {
  const { y, m, d } = parseDate(fecha)

  switch (tipo) {
    case 'dia':
      return { desde: fecha, hasta: fecha }
    case 'semana': {
      const date = new Date(y, m - 1, d)
      const diaSem = date.getDay()
      const lunes = new Date(date)
      lunes.setDate(date.getDate() - (diaSem === 0 ? 6 : diaSem - 1))
      const domingo = new Date(lunes)
      domingo.setDate(lunes.getDate() + 6)
      return { desde: fmt(lunes), hasta: fmt(domingo) }
    }
    case 'mes': {
      const ultimoDia = new Date(y, m, 0).getDate()
      return {
        desde: `${y}-${String(m).padStart(2, '0')}-01`,
        hasta: `${y}-${String(m).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`,
      }
    }
    case 'cuatrimestre': {
      // Enero no es mes hábil: 1º cuatrimestre Mar-Jul, 2º Ago-Nov.
      const indice = Number(cuatrimestre) === 2 ? 2 : 1
      const mesInicio = indice === 2 ? 8 : 3
      const mesFin = indice === 2 ? 11 : 7
      return {
        desde: `${y}-${String(mesInicio).padStart(2, '0')}-01`,
        hasta: `${y}-${String(mesFin).padStart(2, '0')}-30`,
      }
    }
    default:
      return { desde: fecha, hasta: fecha }
  }
}

export const reporteService = {
  generar({ cursoId, tipo, fecha, cuatrimestre }) {
    const { desde, hasta } = buildDateRange(tipo, fecha, cuatrimestre)

    const detalle = db.prepare(
      `SELECT al.alumno_id, al.nombre, al.apellido, a.fecha, a.estado
       FROM alumnos al
       LEFT JOIN asistencias a ON a.alumno_id = al.alumno_id AND a.fecha BETWEEN ? AND ?
       WHERE al.curso_id = ?
       ORDER BY al.apellido, al.nombre, a.fecha`
    ).all(desde, hasta, cursoId)

    const resumen = db.prepare(
      `SELECT al.alumno_id, al.nombre, al.apellido,
              COUNT(CASE WHEN a.estado = 'Presente' THEN 1 END) as presentes,
              COUNT(CASE WHEN a.estado = 'Ausente' THEN 1 END) as ausencias,
              COUNT(CASE WHEN a.estado = 'Justificado' THEN 1 END) as justificados,
              COUNT(CASE WHEN a.estado = 'Tarde' THEN 1 END) as tardanzas,
              COUNT(a.asistencia_id) as total
       FROM alumnos al
       LEFT JOIN asistencias a ON a.alumno_id = al.alumno_id AND a.fecha BETWEEN ? AND ?
       WHERE al.curso_id = ?
       GROUP BY al.alumno_id
       ORDER BY al.apellido, al.nombre`
    ).all(desde, hasta, cursoId)

    const dias = db.prepare(
      `SELECT DISTINCT a.fecha FROM asistencias a
       JOIN alumnos al ON al.alumno_id = a.alumno_id
       WHERE al.curso_id = ? AND a.fecha BETWEEN ? AND ?
       ORDER BY a.fecha`
    ).all(cursoId, desde, hasta).map(r => r.fecha)

    return {
      desde,
      hasta,
      dias,
      resumen,
      detalle,
      ...(tipo === 'cuatrimestre' ? { cuatrimestre: Number(cuatrimestre) === 2 ? 2 : 1 } : {}),
    }
  },

  matrizPorMateria({ cursoId }) {
    const materias = db.prepare(
      `SELECT materia_id, nombre_materia FROM materias WHERE curso_id = ? ORDER BY nombre_materia`
    ).all(cursoId)

    const alumnos = db.prepare(
      'SELECT alumno_id, nombre, apellido FROM alumnos WHERE curso_id = ? ORDER BY apellido, nombre'
    ).all(cursoId)

    const registros = db.prepare(
      `SELECT a.alumno_id, a.materia_id,
              COUNT(*) as total,
              SUM(CASE WHEN a.estado IN ('Presente', 'Tarde') THEN 1 ELSE 0 END) as presentes
       FROM asistencias a
       JOIN alumnos al ON al.alumno_id = a.alumno_id
       WHERE al.curso_id = ?
       GROUP BY a.alumno_id, a.materia_id`
    ).all(cursoId)

    const celdas = new Map()
    for (const r of registros) {
      celdas.set(`${r.alumno_id}:${r.materia_id}`, r)
    }

    const filas = alumnos.map((alumno) => {
      const celdasAlumno = {}
      for (const m of materias) {
        const r = celdas.get(`${alumno.alumno_id}:${m.materia_id}`)
        if (r) {
          celdasAlumno[m.materia_id] = {
            presentes: r.presentes,
            total: r.total,
            porcentaje: r.total > 0 ? Math.round((r.presentes / r.total) * 100) : null,
          }
        }
      }
      return {
        alumno_id: alumno.alumno_id,
        nombre: alumno.nombre,
        apellido: alumno.apellido,
        celdas: celdasAlumno,
      }
    })

    return { materias, alumnos: filas }
  },
}
