import db from './db/index.js'
import { closeDb } from './db/close.js'

const eliminados = db.prepare('DELETE FROM horarios').run().changes

console.log(`[horarios-dev-clean] horarios eliminados: ${eliminados}`)

closeDb()
process.exit(0)
