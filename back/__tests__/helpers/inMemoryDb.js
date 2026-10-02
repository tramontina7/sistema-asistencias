import { vi } from 'vitest'

// La BD en memoria debe existir en el momento en que Vitest ejecuta el factory
// de vi.mock (hoisted al tope del archivo). Por eso se crea dentro de
// vi.hoisted, la única forma segura de compartir estado con el resto del test.
const { testDb } = vi.hoisted(() => {
  // eslint-disable-next-line global-require
  const Database = require('better-sqlite3')
  return { testDb: new Database(':memory:') }
})

vi.mock('../../src/db/index.js', () => ({ default: testDb }))

// El esquema se crea con el runSchema() real de la app, no con una copia del
// DDL. Antes este helper mantenia el DDL duplicado a mano, lo que permitia que
// schema.js y los tests divergieran en silencio: una columna nueva pasaba los
// tests y rompia en produccion. Reusar runSchema mantiene una sola fuente de
// verdad. Requiere que el mock de arriba este declarado antes de este import:
// por eso es un import dinamico y no un import estatico (el hoisting de
// vi.mock lo ejecutaria antes de tiempo).
const { runSchema } = await import('../../src/schema.js')

// Aplica el esquema real. Idempotente: se puede volver a llamar.
export function ensureSchema() {
  runSchema()
  // runSchema() deja las FKs prendidas al terminar, pero better-sqlite3 las
  // define OFF por conexion. Se activan explicitamente para que los tests no
  // dependan de ese detalle interno de schema.js: sin FKs activas los tests
  // dejarian de detectar violaciones de FK.
  testDb.pragma('foreign_keys = ON')
}

/**
 * Devuelve la base en memoria registrada como mock del módulo de BD.
 * Debe llamarse una vez al tope de cada test unit de servicios.
 */
export function setupTestDb() {
  return testDb
}

const RESET_ORDER = [
  'asistencias', 'horarios', 'materias', 'materia_comisiones',
  'alumnos', 'preceptores', 'cursos',
]

export function resetDb(db) {
  // runSchema() usa CREATE TABLE IF NOT EXISTS y solo agrega columnas, asi que
  // es idempotente y no destruye datos. Se llama en cada reset para garantizar
  // que el esquema exista aunque un test anterior lo haya modificado.
  ensureSchema()

  // Se vacian las filas de tablas hijas antes que las padres, para no violar
  // las claves foraneas durante el DELETE.
  const tx = db.transaction(() => {
    for (const table of RESET_ORDER) {
      db.prepare(`DELETE FROM ${table}`).run()
    }
  })
  tx()
}

export function seedCurso(db, { anio = 1, division = '1', especialidad = 'Ciclo Básico', turno = 'Mañana' } = {}) {
  return db.prepare(
    'INSERT INTO cursos (anio, division, especialidad, turno) VALUES (?, ?, ?, ?)'
  ).run(anio, division, especialidad, turno).lastInsertRowid
}

export function seedMateria(db, { cursoId, nombreMateria = 'Matemática', especialidad = 'Ciclo Básico', tipo = 'Teoría' } = {}) {
  return db.prepare(
    'INSERT INTO materias (nombre_materia, especialidad, tipo, curso_id) VALUES (?, ?, ?, ?)'
  ).run(nombreMateria, especialidad, tipo, cursoId).lastInsertRowid
}

export function seedAlumno(db, { nombre = 'Juan', apellido = 'Pérez', dni = '12345678', cursoId, comision = 'A' }) {
  const crypto = { encrypt: (s) => s, decrypt: (s) => s }
  return db.prepare(
    'INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(nombre, apellido, crypto.encrypt(dni), crypto.encrypt(dni), cursoId, comision).lastInsertRowid
}

export function seedHorario(db, { materiaId, dia = 'Lunes', entrada = '08:00', salida = '09:00', comision = null } = {}) {
  return db.prepare(
    'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida, comision) VALUES (?, ?, ?, ?, ?)'
  ).run(materiaId, dia, entrada, salida, comision).lastInsertRowid
}

export function seedAsistencia(db, { alumnoId, materiaId, fecha, estado = 'Presente', motivo = null, horaIngreso = null, motivoTarde = null } = {}) {
  return db.prepare(
    'INSERT INTO asistencias (alumno_id, materia_id, fecha, estado, motivo, hora_ingreso, motivo_tarde) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(alumnoId, materiaId, fecha, estado, motivo, horaIngreso, motivoTarde).lastInsertRowid
}

export function seedPreceptor(db, { nombre = 'Carlos', apellido = 'García', username = 'test', password = 'test123', turno = null, activo = 1 } = {}) {
  const bcrypt = { hashSync: (s) => `hash_${s}` }
  return db.prepare(
    `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash, turno, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(nombre, apellido, `hash_${username}`, `enc_${username}`, '1234-5678', username, bcrypt.hashSync(password), turno, activo).lastInsertRowid
}