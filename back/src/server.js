import { env } from './config/env.js'
import { runSchema } from './schema.js'
import { runSeed } from './seed.js'
import { closeDb } from './db/close.js'
import createApp from './app.js'

// Preparación del esquema y datos iniciales
await runSchema()
await runSeed()

const app = createApp()

const server = app.listen(env.port, () => {
  console.log(`Servidor corriendo en puerto ${env.port}`)
})

// Cierre limpio: detiene el servidor y libera la conexión a la base de datos
function shutdown(signal) {
  console.log(`\nRecibido ${signal}, cerrando servidor...`)
  server.close(() => {
    closeDb()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))