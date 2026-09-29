import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`[config] Falta la variable de entorno ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || './data/school.db',
  jwtSecret: required('JWT_SECRET'),
  encryptionKey: required('ENCRYPTION_KEY'),
  qrSecret: process.env.QR_SECRET || `${process.env.JWT_SECRET}_qr`,
  // Claims iss/aud: blindan contra el reuso de un token entre entornos que
  // compartan el mismo JWT_SECRET. El issuer incluye NODE_ENV por defecto para
  // que dev y prod ya queden diferenciados sin configuracion extra; setealo
  // explicitamente cuando tengas varios entornos con el mismo NODE_ENV
  // (p.ej. dos staging) y quieras distinguirlos.
  jwtIssuer: process.env.JWT_ISSUER || `sistema-asistencias:${process.env.NODE_ENV || 'sin-env'}`,
  jwtAudience: process.env.JWT_AUDIENCE || 'sistema-asistencias-api',
}

// Fail-fast en producción: rechaza secretos débiles o por defecto de desarrollo.
const PALABRAS_DEBILES = ['cambiar', 'probando', 'admin', 'test', 'abc123', 'default', 'secreto', 'secret', '123']
const SECRETOS = [env.jwtSecret, env.encryptionKey, env.qrSecret]

if (process.env.NODE_ENV === 'production') {
  for (const nombre of ['JWT_SECRET', 'ENCRYPTION_KEY', 'QR_SECRET']) {
    const valor = (process.env[nombre] || '') + ''
    if (valor.length < 32) {
      throw new Error(`[config] ${nombre} debe tener al menos 32 caracteres en producción`)
    }
    const lower = valor.toLowerCase()
    if (PALABRAS_DEBILES.some(w => lower.includes(w))) {
      throw new Error(`[config] ${nombre} contiene un valor débil conocido; genere uno con 'openssl rand -hex 32'`)
    }
  }
  SECRETOS.forEach(s => {
    if (typeof s !== 'string' || s.length < 32) {
      throw new Error('[config] Todos los secretos deben tener al menos 32 caracteres en producción')
    }
  })
}