import db from './index.js'

/**
 * Cierra la conexión a la base de datos de forma segura.
 * Se invoca al apagar la aplicación para liberar los archivos WAL/WAL index.
 */
export function closeDb() {
  if (db.open) {
    db.close()
  }
}