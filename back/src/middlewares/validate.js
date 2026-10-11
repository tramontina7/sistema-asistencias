import { body, param, query, validationResult } from 'express-validator'
import { HttpError } from '../utils/http-error.js'

/** Middleware que procesa el resultado de express-validator y lanza HttpError 400 si hay errores. */
export function handleValidation(req, _res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const msg = errors.array().map(e => `${e.path}: ${e.msg}`).join('; ')
    return next(new HttpError(400, msg))
  }
  next()
}

/** Reglas de validación para login de preceptor. */
export const validateLoginPreceptor = [
  body('username').isString().trim().notEmpty().withMessage('username requerido'),
  body('password').isString().notEmpty().withMessage('password requerido'),
  handleValidation
]

/** Reglas de validación para login de alumno. */
export const validateLoginAlumno = [
  body('nombre').isString().trim().notEmpty().withMessage('nombre requerido'),
  body('apellido').isString().trim().notEmpty().withMessage('apellido requerido'),
  body('dni').isString().trim().notEmpty().withMessage('dni requerido')
    .matches(/^\d{7,8}$/).withMessage('dni debe ser numérico de 7 u 8 dígitos'),
  handleValidation
]

/** Reglas de validación para escanear QR. */
export const validateEscanearQr = [
  body('token').isString().notEmpty().withMessage('token requerido'),
  body('fecha').optional().isISO8601().withMessage('fecha debe ser ISO8601 (YYYY-MM-DD)'),
  body('materia_id').optional().isInt({ min: 1 }).withMessage('materia_id debe ser entero positivo'),
  handleValidation
]

/** Reglas de validación para crear alumno. */
export const validateCreateAlumno = [
  body('nombre').isString().trim().notEmpty().withMessage('nombre requerido')
    .isLength({ max: 100 }).withMessage('nombre máx 100 caracteres'),
  body('apellido').isString().trim().notEmpty().withMessage('apellido requerido')
    .isLength({ max: 100 }).withMessage('apellido máx 100 caracteres'),
  body('dni').isString().trim().notEmpty().withMessage('dni requerido')
    .matches(/^\d{7,8}$/).withMessage('dni debe ser numérico de 7 u 8 dígitos'),
  body('curso_id').isInt({ min: 1 }).withMessage('curso_id requerido, entero positivo'),
  body('comision').isString().trim().notEmpty().withMessage('comision requerida')
    .isLength({ max: 10 }).withMessage('comision máx 10 caracteres'),
  handleValidation
]

/** Reglas de validación para actualizar alumno (todos opcionales). */
export const validateUpdateAlumno = [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  body('nombre').optional().isString().trim().notEmpty().withMessage('nombre no puede ser vacío')
    .isLength({ max: 100 }).withMessage('nombre máx 100 caracteres'),
  body('apellido').optional().isString().trim().notEmpty().withMessage('apellido no puede ser vacío')
    .isLength({ max: 100 }).withMessage('apellido máx 100 caracteres'),
  body('dni').optional().isString().trim().notEmpty().withMessage('dni no puede ser vacío')
    .matches(/^\d{7,8}$/).withMessage('dni debe ser numérico de 7 u 8 dígitos'),
  body('curso_id').optional().isInt({ min: 1 }).withMessage('curso_id debe ser entero positivo'),
  body('comision').optional().isString().trim().notEmpty().withMessage('comision no puede ser vacía')
    .isLength({ max: 10 }).withMessage('comision máx 10 caracteres'),
  handleValidation
]

/** Reglas de validación para parámetros de listado de alumnos. */
export const validateListAlumnos = [
  query('curso_id').optional().isInt({ min: 1 }).withMessage('curso_id debe ser entero positivo'),
  query('comision').optional().isString().trim().isLength({ max: 10 }).withMessage('comision máx 10 caracteres'),
  query('q').optional().isString().trim().isLength({ max: 50 }).withMessage('q máx 50 caracteres'),
  handleValidation
]

/** Reglas de validación para ID en params (genérico). */
export const validateIdParam = [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  handleValidation
]

/** Reglas para tomar asistencia (POST /api/asistencias/tomar). */
export const validateTomarAsistencia = [
  body('materia_id').isInt({ min: 1 }).withMessage('materia_id requerido, entero positivo'),
  body('fecha').isISO8601().withMessage('fecha requerida en formato ISO8601 (YYYY-MM-DD)'),
  body('asistencias').isArray({ min: 1 }).withMessage('asistencias requerido, array no vacío'),
  body('asistencias.*.alumno_id').isInt({ min: 1 }).withMessage('cada asistencia debe tener alumno_id entero positivo'),
  body('asistencias.*.estado').isIn(['Presente', 'Ausente', 'Tarde', 'Justificado']).withMessage('estado inválido'),
  body('asistencias.*.motivo').optional().isString().trim().isLength({ max: 200 }).withMessage('motivo máx 200 caracteres'),
  body('asistencias.*.hora_ingreso').optional().matches(/^\d{2}:\d{2}$/).withMessage('hora_ingreso formato HH:MM'),
  body('asistencias.*.motivo_tarde').optional().isString().trim().isLength({ max: 200 }).withMessage('motivo_tarde máx 200 caracteres'),
  handleValidation
]

/** Reglas para listar asistencias (GET /api/asistencias). */
export const validateListAsistencias = [
  query('materia_id').isInt({ min: 1 }).withMessage('materia_id requerido, entero positivo'),
  query('fecha').isISO8601().withMessage('fecha requerida en formato ISO8601 (YYYY-MM-DD)'),
  handleValidation
]

/** Reglas para actualizar estado de asistencia (PUT /api/asistencias/:id). */
export const validateUpdateEstadoAsistencia = [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  body('estado').isIn(['Presente', 'Ausente', 'Tarde', 'Justificado']).withMessage('estado requerido y válido'),
  body('motivo').optional().isString().trim().isLength({ max: 200 }).withMessage('motivo máx 200 caracteres'),
  body('hora_ingreso').optional().matches(/^\d{2}:\d{2}$/).withMessage('hora_ingreso formato HH:MM'),
  body('motivo_tarde').optional().isString().trim().isLength({ max: 200 }).withMessage('motivo_tarde máx 200 caracteres'),
  handleValidation
]

/** Reglas para crear curso (POST /api/cursos). */
export const validateCreateCurso = [
  body('anio').isInt({ min: 1, max: 7 }).withMessage('anio requerido, entre 1 y 7'),
  body('division').isString().trim().notEmpty().withMessage('division requerida')
    .isLength({ max: 10 }).withMessage('division máx 10 caracteres'),
  body('especialidad').isString().trim().notEmpty().withMessage('especialidad requerida')
    .isLength({ max: 50 }).withMessage('especialidad máx 50 caracteres'),
  body('turno').isIn(['Mañana', 'Tarde', 'Vespertino', 'Noche']).withMessage('turno requerido y válido'),
  handleValidation
]

/** Reglas para actualizar curso (PUT /api/cursos/:id). */
export const validateUpdateCurso = [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  body('anio').optional().isInt({ min: 1, max: 7 }).withMessage('anio entre 1 y 7'),
  body('division').optional().isString().trim().notEmpty().withMessage('division no puede ser vacía')
    .isLength({ max: 10 }).withMessage('division máx 10 caracteres'),
  body('especialidad').optional().isString().trim().notEmpty().withMessage('especialidad no puede ser vacía')
    .isLength({ max: 50 }).withMessage('especialidad máx 50 caracteres'),
  body('turno').optional().isIn(['Mañana', 'Tarde', 'Vespertino', 'Noche']).withMessage('turno inválido'),
  handleValidation
]

/** Reglas para listar materias (GET /api/materias). */
export const validateListMaterias = [
  query('curso_id').isInt({ min: 1 }).withMessage('curso_id requerido, entero positivo'),
  handleValidation
]

/** Reglas para crear materia (POST /api/materias). */
export const validateCreateMateria = [
  body('curso_id').isInt({ min: 1 }).withMessage('curso_id requerido, entero positivo'),
  body('nombre_materia').isString().trim().notEmpty().withMessage('nombre_materia requerido')
    .isLength({ max: 100 }).withMessage('nombre_materia máx 100 caracteres'),
  body('especialidad').optional().isString().trim().isLength({ max: 50 }).withMessage('especialidad máx 50 caracteres'),
  body('tipo').optional().isIn(['Teoría', 'Taller', 'Laboratorio']).withMessage('tipo inválido'),
  handleValidation
]

/** Reglas para actualizar materia (PUT /api/materias/:id). */
export const validateUpdateMateria = [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  body('nombre_materia').optional().isString().trim().notEmpty().withMessage('nombre_materia no puede ser vacío')
    .isLength({ max: 100 }).withMessage('nombre_materia máx 100 caracteres'),
  body('especialidad').optional().isString().trim().isLength({ max: 50 }).withMessage('especialidad máx 50 caracteres'),
  body('tipo').optional().isIn(['Teoría', 'Taller', 'Laboratorio']).withMessage('tipo inválido'),
  handleValidation
]

/** Reglas para setHorarios (PUT /api/materias/:id/horarios). */
export const validateSetHorarios = [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  body('horarios').isArray({ min: 1 }).withMessage('horarios requerido, array no vacío'),
  body('horarios.*.dia_semana').isIn(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']).withMessage('dia_semana inválido'),
  body('horarios.*.hora_entrada').matches(/^\d{2}:\d{2}$/).withMessage('hora_entrada formato HH:MM'),
  body('horarios.*.hora_salida').matches(/^\d{2}:\d{2}$/).withMessage('hora_salida formato HH:MM'),
  body('horarios.*.comision').optional().isString().trim().isLength({ max: 10 }).withMessage('comision máx 10 caracteres'),
  handleValidation
]

/** Reglas para setComisiones (PUT /api/materias/:id/comisiones). */
export const validateSetComisiones = [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  body('comisiones').isArray({ min: 1 }).withMessage('comisiones requerido, array no vacío'),
  body('comisiones.*').isString().trim().notEmpty().withMessage('cada comision no puede ser vacía')
    .isLength({ max: 10 }).withMessage('comision máx 10 caracteres'),
  handleValidation
]

/** Reglas para generar reporte (GET /api/reportes). */
export const validateGenerarReporte = [
  query('curso_id').isInt({ min: 1 }).withMessage('curso_id requerido, entero positivo'),
  query('fecha').isISO8601().withMessage('fecha requerida en formato ISO8601 (YYYY-MM-DD)'),
  query('tipo').optional().isIn(['dia', 'cuatrimestre']).withMessage('tipo inválido (dia|cuatrimestre)'),
  query('cuatrimestre').optional().isInt({ min: 1, max: 2 }).withMessage('cuatrimestre 1 o 2'),
  handleValidation
]

/** Reglas para matriz por materia (GET /api/reportes/materia). */
export const validateMatrizPorMateria = [
  query('curso_id').isInt({ min: 1 }).withMessage('curso_id requerido, entero positivo'),
  handleValidation
]