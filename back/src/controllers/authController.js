import { authService } from '../services/authService.js'
import { HttpError } from '../utils/http-error.js'

export const authController = {
  login(req, res) {
    const { username, password } = req.body
    if (!username || !password) {
      throw new HttpError(400, 'Usuario y contraseña requeridos')
    }
    res.json(authService.login({ username, password }))
  },

  me(req, res) {
    res.json(authService.me(req.usuario.id))
  },

  loginAlumno(req, res) {
    const { nombre, apellido, dni } = req.body
    if (!nombre || !apellido || !dni) {
      throw new HttpError(400, 'Nombre, apellido y DNI requeridos')
    }
    res.json(authService.loginAlumno({ nombre, apellido, dni }))
  },
}
