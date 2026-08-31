import { vi } from 'vitest'
import { encrypt } from '../../src/utils/crypto.js'

// El DDL y la creación de la BD deben estar disponibles en el momento en que
// Vitest ejecuta el factory de vi.mock (hoisted al tope del archivo). Por eso
// se construyen dentro de vi.hoisted, que es la única forma segura de compartir
// estado entre el mock y el resto del test.
const { testDb } = vi.hoisted(() => {
  // eslint-disable-next-line global-require
  const Database = require('better-sqlite3')

  const DDL = `
    CREATE TABLE IF NOT EXISTS cursos (
      curso_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      anio         INTEGER NOT NULL CHECK(anio BETWEEN 1 AND 7),
      division     TEXT NOT NULL CHECK(length(division) > 0),
      especialidad TEXT NOT NULL,
      turno        TEXT NOT NULL CHECK(turno IN ('Mañana', 'Tarde', 'Vespertino', 'Noche')),
      UNIQUE(anio, division, especialidad, turno)
    );

    CREATE TABLE IF NOT EXISTS preceptores (
      preceptor_id  INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT NOT NULL,
      apellido      TEXT NOT NULL,
      dni_hash      TEXT NOT NULL UNIQUE,
      dni_cif       TEXT NOT NULL,
      telefono      TEXT NOT NULL,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      turno         TEXT CHECK(turno IS NULL OR turno IN ('Mañana', 'Tarde', 'Noche'))
    );

    CREATE TABLE IF NOT EXISTS alumnos (
      alumno_id   INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT NOT NULL,
      apellido    TEXT NOT NULL,
      dni_hash    TEXT NOT NULL UNIQUE,
      dni_cif     TEXT NOT NULL,
      curso_id    INTEGER NOT NULL REFERENCES cursos(curso_id) ON DELETE RESTRICT,
      comision    TEXT NOT NULL CHECK(length(comision) > 0)
    );

    CREATE TABLE IF NOT EXISTS materias (
      materia_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_materia TEXT NOT NULL,
      especialidad   TEXT NOT NULL,
      tipo           TEXT NOT NULL DEFAULT 'Teoría' CHECK(tipo IN ('Teoría', 'Taller', 'Laboratorio')),
      curso_id       INTEGER NOT NULL REFERENCES cursos(curso_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS horarios (
      horario_id   INTEGER PRIMARY KEY AUTOINCREMENT,
      materia_id   INTEGER NOT NULL REFERENCES materias(materia_id) ON DELETE CASCADE,
      dia_semana   TEXT NOT NULL CHECK(dia_semana IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado')),
      hora_entrada TEXT NOT NULL CHECK(hora_entrada LIKE '__:__'),
      hora_salida  TEXT NOT NULL CHECK(hora_salida LIKE '__:__' AND hora_salida > hora_entrada),
      comision     TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS materia_comisiones (
      materia_comision_id INTEGER PRIMARY KEY AUTOINCREMENT,
      materia_id          INTEGER NOT NULL REFERENCES materias(materia_id) ON DELETE CASCADE,
      comision            TEXT NOT NULL,
      UNIQUE(materia_id, comision)
    );

    CREATE TABLE IF NOT EXISTS asistencias (
      asistencia_id INTEGER PRIMARY KEY AUTOINCREMENT,
      alumno_id     INTEGER NOT NULL REFERENCES alumnos(alumno_id) ON DELETE CASCADE,
      materia_id    INTEGER NOT NULL REFERENCES materias(materia_id) ON DELETE RESTRICT,
      fecha         TEXT NOT NULL DEFAULT (CURRENT_DATE),
      estado        TEXT NOT NULL CHECK(estado IN ('Presente', 'Ausente', 'Tarde', 'Justificado')),
      motivo        TEXT NULL,
      hora_ingreso  TEXT NULL,
      motivo_tarde  TEXT NULL,
      UNIQUE(alumno_id, materia_id, fecha)
    );
  `

  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)

  return { testDb: db }
})

// Mock del módulo de BD. Se declara al tope (junto al vi.hoisted que crea la
// instancia) para respetar el hoisting de Vitest. Los tests unit de servicios
// se registran contra esta misma base en memoria vía setupTestDb().
vi.mock('../../src/db/index.js', () => ({ default: testDb }))

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

export function seedPreceptor(db, { nombre = 'Carlos', apellido = 'García', username = 'test', password = 'test123' } = {}) {
  const bcrypt = { hashSync: (s) => `hash_${s}` }
  return db.prepare(
    `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(nombre, apellido, `hash_${username}`, `enc_${username}`, '1234-5678', username, bcrypt.hashSync(password)).lastInsertRowid
}