import db from '../db/index.js'
import { HttpError } from '../utils/http-error.js'
import { formatNombre } from './cursoService.js'

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_VALIDOS = DIAS_SEMANA.slice(1)

function validarFecha(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new HttpError(400, 'Formato de fecha inválido (YYYY-MM-DD)')
}

function diaSemanaDeFecha(fecha) {
  const [y, m, d] = fecha.split('-').map(Number)
  return DIAS_SEMANA[new Date(y, m - 1, d).getDay()]
}

function cargosDeDocente(docenteId) {
  const comoTitular = db.prepare(
    `SELECT m.materia_id, m.nombre_materia, m.especialidad, c.anio, c.division, NULL as comision
     FROM materias m
     JOIN cursos c ON c.curso_id = m.curso_id
     WHERE m.docente_id = ?`
  ).all(docenteId)
  const porComision = db.prepare(
    `SELECT m.materia_id, m.nombre_materia, m.especialidad, c.anio, c.division, mc.comision
     FROM materia_comisiones mc
     JOIN materias m ON m.materia_id = mc.materia_id
     JOIN cursos c ON c.curso_id = m.curso_id
     WHERE mc.docente_id = ?`
  ).all(docenteId)
  return [...comoTitular, ...porComision]
}

export const ausenciaService = {
  marcar(docenteId, fecha) {
    const docente = db.prepare('SELECT docente_id FROM docentes WHERE docente_id = ?').get(docenteId)
    if (!docente) throw new HttpError(404, 'Docente no encontrado')
    validarFecha(fecha)
    db.prepare(
      `INSERT INTO docente_ausencias (docente_id, fecha) VALUES (?, ?)
       ON CONFLICT(docente_id, fecha) DO NOTHING`
    ).run(docenteId, fecha)
    return { docente_id: Number(docenteId), fecha }
  },

  quitar(docenteId, fecha) {
    validarFecha(fecha)
    const result = db.prepare(
      'DELETE FROM docente_ausencias WHERE docente_id = ? AND fecha = ?'
    ).run(docenteId, fecha)
    if (result.changes === 0) throw new HttpError(404, 'El docente no está marcado ausente en esa fecha')
    return { message: 'Ausencia quitada' }
  },

  listar({ fecha }) {
    if (!fecha) throw new HttpError(400, 'fecha requerida')
    validarFecha(fecha)
    const dia = diaSemanaDeFecha(fecha)
    if (!DIAS_VALIDOS.includes(dia)) {
      throw new HttpError(400, `La fecha cae en ${dia}, no hay clases`)
    }

    const ausentesMarcados = db.prepare(
      `SELECT a.docente_id, d.nombre, d.apellido
       FROM docente_ausencias a
       JOIN docentes d ON d.docente_id = a.docente_id
       WHERE a.fecha = ?`
    ).all(fecha)

    const licencia = db.prepare(
      `SELECT docente_id, nombre, apellido
       FROM docentes WHERE estado = 'Licencia'`
    ).all()

    const conReemplazo = new Set(
      db.prepare('SELECT materia_id, comision FROM docente_suplencias').all()
        .map(r => `${r.materia_id}|${r.comision ?? ''}`)
    )

    const porId = new Map()
    for (const a of ausentesMarcados) porId.set(String(a.docente_id), { ...a, motivo: 'ausencia' })
    for (const l of licencia) porId.set(String(l.docente_id), { ...l, motivo: 'licencia' })

    const ausentes = [...porId.values()].sort((x, y) =>
      (x.apellido + x.nombre).localeCompare(y.apellido + y.nombre)
    )

    return ausentes.map(({ docente_id, nombre, apellido, motivo }) => {
      const bloques = []
      for (const c of cargosDeDocente(docente_id)) {
        if (conReemplazo.has(`${c.materia_id}|${c.comision ?? ''}`)) continue
        const hs = db.prepare(
          'SELECT dia_semana, hora_entrada, hora_salida FROM horarios WHERE materia_id = ? AND dia_semana = ? ORDER BY hora_entrada'
        ).all(c.materia_id, dia)
        for (const h of hs) {
          bloques.push({
            materia_id: c.materia_id,
            nombre_materia: c.nombre_materia,
            curso_nombre: formatNombre(c),
            comision: c.comision,
            dia_semana: h.dia_semana,
            hora_entrada: h.hora_entrada,
            hora_salida: h.hora_salida,
          })
        }
      }
      return { docente_id, nombre, apellido, motivo, bloques }
    })
  },

  listarDocentes({ fecha }) {
    if (!fecha) throw new HttpError(400, 'fecha requerida')
    validarFecha(fecha)
    const ausentes = new Set(
      db.prepare('SELECT docente_id FROM docente_ausencias WHERE fecha = ?').all(fecha)
        .map(r => String(r.docente_id))
    )
    const docentes = db.prepare(
      'SELECT docente_id, nombre, apellido, estado FROM docentes ORDER BY apellido, nombre'
    ).all()
    return docentes.map(d => {
      const licencia = d.estado === 'Licencia'
      return {
        docente_id: d.docente_id,
        nombre: d.nombre,
        apellido: d.apellido,
        licencia,
        ausente: ausentes.has(String(d.docente_id)) || licencia,
      }
    })
  },
}
