import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { env } from '../config/env.js'

const dbPath = path.resolve(env.dbPath)
const dir = path.dirname(dbPath)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const db = new Database(dbPath)

// Modo WAL: maximiza el rendimiento en accesos concurrentes de lectura/escritura
db.pragma('journal_mode = WAL')
// Recomendado por SQLite junto a WAL: durabilidad adecuada con mejor rendimiento
db.pragma('synchronous = NORMAL')
// Evita errores SQLITE_BUSY transitorios bajo contención de escritura
db.pragma('busy_timeout = 5000')
db.pragma('foreign_keys = ON')

export default db