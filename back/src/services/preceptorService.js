import bcrypt from 'bcryptjs'
import db from '../db/index.js'
import { encrypt } from '../utils/crypto.js'

// Inserta/actualiza preceptores de forma idempotente por username.
export async function asegurarPreceptores(lista) {
  for (const u of lista) {
    if (!u.username || !u.password || !u.nombre || !u.apellido || !u.telefono) {
      throw new Error('[seed] Cada preceptor debe incluir username, password, nombre, apellido y telefono')
    }
    if (!u.dni) {
      throw new Error('[seed] Cada preceptor debe incluir un dni numérico')
    }
  }
  const hashes = {}
  for (const u of lista) {
    if (!(u.password in hashes)) {
      hashes[u.password] = await bcrypt.hash(u.password, 12)
    }
  }
  const tx = db.transaction(() => {
    const insert = db.prepare(
      `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash, turno)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const updateTurno = db.prepare('UPDATE preceptores SET turno = ? WHERE username = ?')
    for (const u of lista) {
      const existente = db.prepare('SELECT preceptor_id, turno FROM preceptores WHERE username = ?').get(u.username)
      if (existente) {
        if (existente.turno !== u.turno) updateTurno.run(u.turno, u.username)
      } else {
        insert.run(u.nombre, u.apellido, encrypt(u.dni), encrypt(u.dni), u.telefono, u.username, hashes[u.password], u.turno)
      }
    }
  })
  tx()
}
