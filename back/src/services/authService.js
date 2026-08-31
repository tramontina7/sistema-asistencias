import bcrypt from 'bcryptjs'
import db from '../db/index.js'
import { signToken } from '../utils/jwt.js'
import { HttpError } from '../utils/http-error.js'

export const authService = {
  login({ username, password }) {
    const user = db.prepare(
      `SELECT preceptor_id, username, password_hash, nombre, apellido, turno
       FROM preceptores WHERE username = ?`
    ).get(username)

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new HttpError(401, 'Credenciales inválidas')
    }

    const payload = {
      id: user.preceptor_id,
      username: user.username,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: 'preceptor',
      turno: user.turno,
    }

    return {
      token: signToken(payload, '8h'),
      usuario: payload,
    }
  },

  me(userId) {
    const user = db.prepare(
      `SELECT preceptor_id as id, username, nombre, apellido, turno
       FROM preceptores WHERE preceptor_id = ?`
    ).get(userId)

    if (!user) throw new HttpError(401, 'Usuario no encontrado')
    return { ...user, rol: 'preceptor' }
  },
}
