import db from './db/index.js'
import { closeDb } from './db/close.js'

// La fecha se alinea con la que usa SQLite al insertar (CURRENT_DATE local),
// para borrar exactamente lo que se considera "hoy" en la base.
const fecha = db.prepare("SELECT date('now', 'localtime') AS d").get().d

const limpiar = db.transaction(() => {
  const asistencias = db.prepare('DELETE FROM asistencias WHERE fecha = ?').run(fecha).changes
  const retiros = db.prepare('DELETE FROM retiros WHERE fecha = ?').run(fecha).changes
  return { asistencias, retiros }
})

const { asistencias, retiros } = limpiar()

console.log(`[limpiar] fecha: ${fecha}`)
console.log(`[limpiar] asistencias eliminadas: ${asistencias}`)
console.log(`[limpiar] retiros eliminados: ${retiros}`)

closeDb()
process.exit(0)
