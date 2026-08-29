import db from './db/index.js'
import { closeDb } from './db/close.js'
import { encrypt } from './utils/crypto.js'

const COMISIONES = ['A', 'B']
const ALUMNOS_POR_COMISION = 6
const PREFIJO = '[DEV]'

const NOMBRES = ['Lucas', 'Emma', 'Benjamín', 'Martina', 'Thiago', 'Julieta', 'Santino', 'Carla', 'Agustín', 'Renata', 'Valentín', 'Mía']
const APELLIDOS = ['Díaz', 'Fernández', 'Ledesma', 'Acosta', 'Romero', 'Castro', 'Molina', 'Sosa', 'Peralta', 'Vega']

function generarDni(base) {
  // Código de área fijo para DNI de prueba (entre 60000000 y 69999999).
  return String(60000000 + base)
}

function existeDev(cursoId, comision) {
  return db.prepare(
    "SELECT COUNT(*) AS c FROM alumnos WHERE curso_id = ? AND comision = ? AND apellido LIKE ?"
  ).get(cursoId, comision, `${PREFIJO} %`).c > 0
}

function insertar() {
  const cursos = db.prepare(
    'SELECT curso_id, anio, division, especialidad FROM cursos ORDER BY anio, division, especialidad'
  ).all()

  let total = 0
  let conDev = 0
  let sinDev = 0
  let dniBase = 0

  const insertAlumno = db.prepare(
    'INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision) VALUES (?, ?, ?, ?, ?, ?)'
  )

  const tx = db.transaction(() => {
    for (const curso of cursos) {
      for (const comision of COMISIONES) {
        if (existeDev(curso.curso_id, comision)) {
          conDev++
          continue
        }
        sinDev++
        for (let i = 0; i < ALUMNOS_POR_COMISION; i++) {
          const nombre = NOMBRES[total % NOMBRES.length]
          const apellido = `${PREFIJO} ${APELLIDOS[total % APELLIDOS.length]}`
          const dni = generarDni(dniBase)
          dniBase++
          insertAlumno.run(nombre, apellido, encrypt(dni), encrypt(dni), curso.curso_id, comision)
          total++
        }
      }
    }
  })

  tx()

  return { total, conDev, sinDev, cursos: cursos.length }
}

const { total, conDev, sinDev, cursos } = insertar()

console.log(`[alumnos-dev] cursos procesados: ${cursos}`)
console.log(`[alumnos-dev] comisiones ya con [DEV]: ${conDev}`)
console.log(`[alumnos-dev] comisiones nuevas: ${sinDev}`)
console.log(`[alumnos-dev] alumnos insertados: ${total}`)

closeDb()
process.exit(0)
