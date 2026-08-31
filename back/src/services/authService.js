import bcrypt from 'bcryptjs'
import db from '../db/index.js'
import { decrypt } from '../utils/crypto.js'
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

  loginAlumno({ nombre, apellido, dni }) {
    const dniText = String(dni)
    const candidatos = db.prepare(
      `SELECT alumno_id, nombre, apellido, curso_id, dni_cif
       FROM alumnos
       WHERE LOWER(nombre) = LOWER(?) AND LOWER(apellido) = LOWER(?)`
    ).all(nombre, apellido)

    const alumno = candidatos.find(a => decrypt(a.dni_cif) === dniText)

    if (!alumno) {
      throw new HttpError(401, 'Datos incorrectos. Verificá tu nombre, apellido y DNI.')
    }

    const token = signToken(
      {
        tipo: 'alumno',
        alumno_id: alumno.alumno_id,
        nombre: alumno.nombre,
        apellido: alumno.apellido,
        curso_id: alumno.curso_id,
      },
      '1h'
    )

    return {
      token,
      alumno: {
        id: alumno.alumno_id,
        nombre: alumno.nombre,
        apellido: alumno.apellido,
        curso_id: alumno.curso_id,
      },
    }
  },
}
