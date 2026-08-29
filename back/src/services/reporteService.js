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

export function buildDateRange(tipo, fecha) {
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
      const cuatri = Math.floor((m - 1) / 4) + 1
      const mesInicio = (cuatri - 1) * 4 + 1
      const mesFin = mesInicio + 3
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
  generar({ cursoId, tipo, fecha }) {
    const { desde, hasta } = buildDateRange(tipo, fecha)

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

    return { desde, hasta, dias, resumen, detalle }
  },

  faltasPorMateria({ cursoId, desde, hasta }) {
    const materias = db.prepare(
      `SELECT materia_id, nombre_materia FROM materias WHERE curso_id = ? ORDER BY nombre_materia`
    ).all(cursoId)

    const horarios = db.prepare(
      `SELECT h.materia_id, h.dia_semana
       FROM horarios h
       WHERE h.materia_id IN (SELECT materia_id FROM materias WHERE curso_id = ?)`
    ).all(cursoId)
    const diasMap = {}
    for (const h of horarios) {
      (diasMap[h.materia_id] ||= new Set()).add(h.dia_semana)
    }

    const ausentes = db.prepare(
      `SELECT a.alumno_id, a.materia_id, a.fecha
       FROM asistencias a
       JOIN alumnos al ON al.alumno_id = a.alumno_id
       WHERE al.curso_id = ? AND a.estado = 'Ausente' AND a.fecha BETWEEN ? AND ?`
    ).all(cursoId, desde, hasta)

    const alumnos = db.prepare(
      'SELECT alumno_id, nombre, apellido FROM alumnos WHERE curso_id = ? ORDER BY apellido, nombre'
    ).all(cursoId)

    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

    const conteo = new Map()
    for (const a of ausentes) {
      const wd = diasSemana[new Date(a.fecha).getDay()]
      if (diasMap[a.materia_id]?.has(wd)) {
        const k = `${a.alumno_id}:${a.materia_id}`
        conteo.set(k, (conteo.get(k) || 0) + 1)
      }
    }

    const sesiones = (materiaId) => {
      if (!diasMap[materiaId]) return 0
      return this._contarDias(desde, hasta, diasMap[materiaId])
    }

    const filas = []
    for (const alumno of alumnos) {
      for (const m of materias) {
        const aus = conteo.get(`${alumno.alumno_id}:${m.materia_id}`) || 0
        const s = sesiones(m.materia_id)
        filas.push({
          alumno_id: alumno.alumno_id,
          nombre: alumno.nombre,
          apellido: alumno.apellido,
          materia_id: m.materia_id,
          materia_nombre: m.nombre_materia,
          ausencias: aus,
          sesiones: s,
          porcentaje: s > 0 ? Math.round((aus / s) * 1000) / 10 : 0,
        })
      }
    }
    return filas
  },

  _contarDias(desde, hasta, dias) {
    const [y1, m1, d1] = desde.split('-').map(Number)
    const start = new Date(y1, m1 - 1, d1)
    const [y2, m2, d2] = hasta.split('-').map(Number)
    const end = new Date(y2, m2 - 1, d2)
    let count = 0
    const cur = new Date(start)
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    while (cur <= end) {
      if (dias.has(diasSemana[cur.getDay()])) count++
      cur.setDate(cur.getDate() + 1)
    }
    return count
  },
}
