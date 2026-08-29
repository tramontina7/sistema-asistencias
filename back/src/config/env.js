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
}