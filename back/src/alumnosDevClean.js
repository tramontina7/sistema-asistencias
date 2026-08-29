import db from './db/index.js'
import { closeDb } from './db/close.js'

const PREFIJO = '[DEV]'

const borrar = db.transaction(() => {
  const eliminados = db.prepare(
    'DELETE FROM alumnos WHERE apellido LIKE ?'
  ).run(`${PREFIJO} %`).changes
  return eliminados
})

const eliminados = borrar()

console.log(`[alumnos-dev-clean] alumnos [DEV] eliminados: ${eliminados}`)

closeDb()
process.exit(0)
