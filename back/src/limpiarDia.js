import db from './db/index.js'
import { closeDb } from './db/close.js'

// La fecha se alinea con la que usa SQLite al insertar (CURRENT_DATE local),
// para borrar exactamente lo que se considera "hoy" en la base.
const fecha = db.prepare("SELECT date('now', 'localtime') AS d").get().d

const asistencias = db.prepare('DELETE FROM asistencias WHERE fecha = ?').run(fecha).changes

console.log(`[limpiar] fecha: ${fecha}`)
console.log(`[limpiar] asistencias eliminadas: ${asistencias}`)

closeDb()
process.exit(0)
