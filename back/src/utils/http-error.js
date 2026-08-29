/**
 * Error con estado HTTP asociado.
 * Los servicios lanzan HttpError(status, message); el middleware de errores
 * lo traduce a una respuesta JSON con el código correspondiente.
 */
export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
  }
}