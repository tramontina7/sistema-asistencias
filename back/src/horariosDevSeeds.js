import db from './db/index.js'
import { closeDb } from './db/close.js'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const BLOQUES = {
  Mañana: [
    { entrada: '07:50', salida: '09:50' },
    { entrada: '10:00', salida: '12:00' },
  ],
  Tarde: [
    { entrada: '12:50', salida: '14:50' },
    { entrada: '15:00', salida: '17:00' },
  ],
  Noche: [
    { entrada: '17:30', salida: '19:10' },
    { entrada: '19:20', salida: '21:00' },
  ],
}

// Mapa de rangos por anio y turno del curso -> { teorica, taller }
function rangosPara(curso) {
  if (curso.anio >= 6) {
    return {
      teorica: 'Noche',
      taller: curso.anio === 7 ? 'Noche' : 'Tarde',
    }
  }
  // 1ro a 5to: el taller va al turno opuesto del turno del curso
  return {
    teorica: curso.turno,
    taller: curso.turno === 'Mañana' ? 'Tarde' : 'Mañana',
  }
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function procesar() {
  // 1) Asegurar columnas de esquema
  const horCols = db.prepare('PRAGMA table_info(horarios)').all().map(c => c.name)
  if (!horCols.includes('comision')) db.exec('ALTER TABLE horarios ADD COLUMN comision TEXT NULL')
  if (!horCols.includes('docente_id')) {
    db.exec('ALTER TABLE horarios ADD COLUMN docente_id INTEGER REFERENCES docentes(docente_id) ON DELETE SET NULL')
  }

  // 2) Completar materia_comisiones para talleres/lab sin comisiones
  const sinComisiones = db.prepare(
    `SELECT m.materia_id, m.docente_id
     FROM materias m
     WHERE m.tipo IN ('Taller', 'Laboratorio')
       AND NOT EXISTS (SELECT 1 FROM materia_comisiones mc WHERE mc.materia_id = m.materia_id)`
  ).all()
  const insertComision = db.prepare(
    'INSERT OR IGNORE INTO materia_comisiones (materia_id, comision, docente_id) VALUES (?, ?, ?)'
  )
  const tx1 = db.transaction(() => {
    for (const mc of sinComisiones) {
      insertComision.run(mc.materia_id, 'A', mc.docente_id || null)
      insertComision.run(mc.materia_id, 'B', mc.docente_id || null)
    }
  })
  tx1()

  // 3) Borrar todos los horarios existentes
  db.prepare('DELETE FROM horarios').run()

  // 4) Generar cronograma por curso
  const cursos = db.prepare(
    'SELECT curso_id, anio, division, especialidad, turno FROM cursos ORDER BY anio, division, especialidad'
  ).all()

  const insertHorario = db.prepare(
    'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida, comision, docente_id) VALUES (?, ?, ?, ?, ?, ?)'
  )

  const resumen = { cursos: 0, teorica: 0, taller: 0, sinBloque: 0 }

  const tx = db.transaction(() => {
    for (const curso of cursos) {
      const rangos = rangosPara(curso)

      const materias = db.prepare(
        'SELECT materia_id, nombre_materia, tipo FROM materias WHERE curso_id = ? ORDER BY materia_id'
      ).all(curso.curso_id)

      const teoricas = materias.filter(m => m.tipo === 'Teoría')
      const talleres = materias.filter(m => m.tipo !== 'Teoría')

      // ----- Construir unidades a calendarizar -----
      // Teóricas: comision NULL (una a la vez, todos los alumnos).
      // Talleres/lab: una unidad por comisión.
      const unidades = []
      for (const t of teoricas) {
        unidades.push({ materia_id: t.materia_id, comision: null })
      }

      const comisionesPorMateria = new Map()
      if (talleres.length > 0) {
        const filasCom = db.prepare(
          `SELECT materia_id, comision, docente_id FROM materia_comisiones
           WHERE materia_id IN (${talleres.map(() => '?').join(',')})`
        ).all(...talleres.map(m => m.materia_id))
        for (const c of filasCom) {
          if (!comisionesPorMateria.has(c.materia_id)) comisionesPorMateria.set(c.materia_id, [])
          comisionesPorMateria.get(c.materia_id).push(c)
        }
      }
      for (const mat of talleres) {
        const coms = comisionesPorMateria.get(mat.materia_id) || []
        if (coms.length === 0) {
          unidades.push({ materia_id: mat.materia_id, comision: null, docente_id: mat.docente_id || null })
        } else {
          for (const c of coms) {
            unidades.push({ materia_id: mat.materia_id, comision: c.comision, docente_id: c.docente_id || null })
          }
        }
      }
      // Las teóricas no tienen docente en el horario (docente = null)
      for (const u of unidades) {
        if (u.docente_id === undefined) u.docente_id = null
      }

      // ----- Rango horario según el tipo de unidad -----
      const rangoDeUnidad = (u) =>
        u.comision === null && teoricas.some(t => t.materia_id === u.materia_id)
          ? rangos.teorica
          : rangos.taller

      // Si teoría y taller comparten rango (ej. 7mo: todo a la noche) se usa un único
      // mapa de ocupación; si no, mapas separados.
      const bloquesPorRango = {
        [rangos.teorica]: BLOQUES[rangos.teorica],
        [rangos.taller]: BLOQUES[rangos.taller],
      }
      const ocupadoPorRango = {}
      for (const r of new Set([rangos.teorica, rangos.taller])) {
        ocupadoPorRango[r] = new Map() // key dia|franja -> set de comisiones
      }

      // Días ya usados por materia (para no repetir la misma materia el mismo día)
      const diasPorMateria = new Map()

      const orden = shuffle(unidades)
      for (const u of orden) {
        const rango = rangoDeUnidad(u)
        const bloques = bloquesPorRango[rango]
        const ocupado = ocupadoPorRango[rango]
        const diasUsados = diasPorMateria.get(u.materia_id) || new Set()
        let asignado = false

        for (const dia of shuffle(DIAS)) {
          if (diasUsados.has(dia)) continue
          for (const b of shuffle(bloques)) {
            const key = `${dia}|${b.entrada}-${b.salida}`
            const coms = ocupado.get(key) || new Set()
            if (!puedeEntrar(coms, u.comision)) continue
            insertHorario.run(u.materia_id, dia, b.entrada, b.salida, u.comision, u.docente_id)
            ocupado.set(key, new Set([...coms, u.comision]))
            diasUsados.add(dia)
            diasPorMateria.set(u.materia_id, diasUsados)
            if (u.comision === null) {
              resumen.teorica++
            } else {
              resumen.taller++
            }
            asignado = true
            break
          }
          if (asignado) break
        }
        if (!asignado) resumen.sinBloque++
      }

      resumen.cursos++
    }
  })
  tx()

  return resumen
}

// Una unidad puede entrar en un bloque según la ocupación de comisiones:
//  - Bloque vacío: cualquiera.
//  - Teoría (comision null): solo en bloque vacío (afecta a todos).
//  - Taller: solo en bloque con comisión distinta; NULL no comparte con nadie.
function puedeEntrar(coms, com) {
  if (coms.size === 0) return true
  if (com === null) return false
  if (coms.has(null) || coms.has(com)) return false
  if (coms.size >= 2) return false
  return true
}

const resumen = procesar()

console.log(`[horarios-dev] cursos procesados: ${resumen.cursos}`)
console.log(`[horarios-dev] horarios teóricos: ${resumen.teorica}`)
console.log(`[horarios-dev] horarios taller/lab: ${resumen.taller}`)
console.log(`[horarios-dev] unidades sin bloque disponible: ${resumen.sinBloque}`)

closeDb()
process.exit(0)
