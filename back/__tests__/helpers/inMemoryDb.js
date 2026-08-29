import Database from 'better-sqlite3'
import { encrypt } from '../../src/utils/crypto.js'

export const DDL = `
  CREATE TABLE IF NOT EXISTS tutores (
    tutor_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre    TEXT NOT NULL,
    apellido  TEXT NOT NULL,
    dni_hash  TEXT NOT NULL UNIQUE,
    dni_cif   TEXT NOT NULL,
    telefono  TEXT NOT NULL
  );

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
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS docentes (
    docente_id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT NOT NULL,
    apellido   TEXT NOT NULL,
    dni_hash   TEXT NOT NULL UNIQUE,
    dni_cif    TEXT NOT NULL,
    correo     TEXT NULL CHECK(correo LIKE '%@%'),
    telefono   TEXT NOT NULL,
    estado     TEXT NOT NULL DEFAULT 'Disponible' CHECK(estado IN ('Disponible', 'Licencia'))
  );

  CREATE TABLE IF NOT EXISTS docente_materias (
    docente_id     INTEGER NOT NULL REFERENCES docentes(docente_id) ON DELETE CASCADE,
    nombre_materia TEXT NOT NULL,
    PRIMARY KEY (docente_id, nombre_materia)
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

  CREATE TABLE IF NOT EXISTS alumnos_tutores (
    alumno_id    INTEGER NOT NULL REFERENCES alumnos(alumno_id) ON DELETE CASCADE,
    tutor_id     INTEGER NOT NULL REFERENCES tutores(tutor_id) ON DELETE CASCADE,
    parentesco   TEXT NOT NULL,
    es_principal INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (alumno_id, tutor_id)
  );

  CREATE TABLE IF NOT EXISTS preceptores_cursos (
    preceptor_id INTEGER NOT NULL REFERENCES preceptores(preceptor_id) ON DELETE CASCADE,
    curso_id     INTEGER NOT NULL REFERENCES cursos(curso_id) ON DELETE CASCADE,
    PRIMARY KEY (preceptor_id, curso_id)
  );

  CREATE TABLE IF NOT EXISTS materias (
    materia_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_materia TEXT NOT NULL,
    especialidad   TEXT NOT NULL,
    tipo           TEXT NOT NULL DEFAULT 'Teoría' CHECK(tipo IN ('Teoría', 'Taller', 'Laboratorio')),
    curso_id       INTEGER NOT NULL REFERENCES cursos(curso_id) ON DELETE RESTRICT,
    docente_id     INTEGER REFERENCES docentes(docente_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS horarios (
    horario_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    materia_id   INTEGER NOT NULL REFERENCES materias(materia_id) ON DELETE CASCADE,
    dia_semana   TEXT NOT NULL CHECK(dia_semana IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado')),
    hora_entrada TEXT NOT NULL CHECK(hora_entrada LIKE '__:__'),
    hora_salida  TEXT NOT NULL CHECK(hora_salida LIKE '__:__' AND hora_salida > hora_entrada),
    comision     TEXT NULL,
    docente_id   INTEGER REFERENCES docentes(docente_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS asistencias (
    asistencia_id INTEGER PRIMARY KEY AUTOINCREMENT,
    alumno_id     INTEGER NOT NULL REFERENCES alumnos(alumno_id) ON DELETE CASCADE,
    materia_id    INTEGER NOT NULL REFERENCES materias(materia_id) ON DELETE RESTRICT,
    fecha         TEXT NOT NULL DEFAULT (CURRENT_DATE),
    estado        TEXT NOT NULL CHECK(estado IN ('Presente', 'Ausente', 'Tarde', 'Justificado')),
    motivo        TEXT NULL,
    UNIQUE(alumno_id, materia_id, fecha)
  );

  CREATE TABLE IF NOT EXISTS previas (
    previa_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    alumno_id        INTEGER NOT NULL REFERENCES alumnos(alumno_id) ON DELETE CASCADE,
    materia_id       INTEGER NOT NULL REFERENCES materias(materia_id) ON DELETE RESTRICT,
    docente_id       INTEGER REFERENCES docentes(docente_id) ON DELETE SET NULL,
    anio_cursada     INTEGER NOT NULL CHECK(anio_cursada BETWEEN 2000 AND 2100),
    estado           TEXT NOT NULL CHECK(estado IN ('Pendiente', 'Aprobada', 'Regularizada', 'En Curso')),
    fecha_evaluacion TEXT NULL,
    nota             INTEGER NULL CHECK(nota BETWEEN 1 AND 10)
  );

  CREATE TABLE IF NOT EXISTS materia_comisiones (
    materia_comision_id INTEGER PRIMARY KEY AUTOINCREMENT,
    materia_id          INTEGER NOT NULL REFERENCES materias(materia_id) ON DELETE CASCADE,
    comision            TEXT NOT NULL,
    docente_id          INTEGER REFERENCES docentes(docente_id) ON DELETE SET NULL,
    UNIQUE(materia_id, comision)
  );

  CREATE TABLE IF NOT EXISTS docente_suplencias (
    materia_id          INTEGER NOT NULL REFERENCES materias(materia_id) ON DELETE CASCADE,
    comision            TEXT NULL,
    suplente_docente_id INTEGER NOT NULL REFERENCES docentes(docente_id) ON DELETE CASCADE,
    PRIMARY KEY (materia_id, comision)
  );

  CREATE TABLE IF NOT EXISTS docente_ausencias (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    docente_id INTEGER NOT NULL REFERENCES docentes(docente_id) ON DELETE CASCADE,
    fecha      TEXT NOT NULL,
    UNIQUE(docente_id, fecha)
  );

  CREATE TABLE IF NOT EXISTS retiros (
    retiro_id INTEGER PRIMARY KEY AUTOINCREMENT,
    alumno_id INTEGER NOT NULL REFERENCES alumnos(alumno_id) ON DELETE CASCADE,
    tutor_id  INTEGER NOT NULL REFERENCES tutores(tutor_id) ON DELETE RESTRICT,
    fecha     TEXT NOT NULL DEFAULT (CURRENT_DATE),
    hora      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`

export function createInMemoryDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return db
}

const RESET_ORDER = [
  'retiros', 'previas', 'asistencias', 'docente_suplencias',
  'horarios', 'materias', 'docente_materias', 'alumnos_tutores', 'alumnos',
  'preceptores_cursos', 'preceptores', 'docentes', 'cursos', 'tutores',
]

export function resetDb(db) {
  const tx = db.transaction(() => {
    for (const table of RESET_ORDER) {
      db.prepare(`DELETE FROM ${table}`).run()
    }
  })
  tx()
}

export function seedTurnos() {
  return { mañana: 'Mañana', tarde: 'Tarde', vespertino: 'Vespertino' }
}

export function seedCurso(db, { anio = 1, division = '1', especialidad = 'Ciclo Básico', turno = 'Mañana' } = {}) {
  return db.prepare(
    'INSERT INTO cursos (anio, division, especialidad, turno) VALUES (?, ?, ?, ?)'
  ).run(anio, division, especialidad, turno).lastInsertRowid
}

export function seedMateria(db, { cursoId, nombreMateria = 'Matemática', especialidad = 'Ciclo Básico', docenteId = null, tipo = 'Teoría' } = {}) {
  return db.prepare(
    'INSERT INTO materias (nombre_materia, especialidad, tipo, curso_id, docente_id) VALUES (?, ?, ?, ?, ?)'
  ).run(nombreMateria, especialidad, tipo, cursoId, docenteId).lastInsertRowid
}

export function seedAlumno(db, { nombre = 'Juan', apellido = 'Pérez', dni = '12345678', cursoId, comision = 'A' }) {
  const crypto = { encrypt: (s) => s, decrypt: (s) => s }
  return db.prepare(
    'INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(nombre, apellido, crypto.encrypt(dni), crypto.encrypt(dni), cursoId, comision).lastInsertRowid
}

export function seedHorario(db, { materiaId, dia = 'Lunes', entrada = '08:00', salida = '09:00', comision = null, docenteId = null } = {}) {
  return db.prepare(
    'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida, comision, docente_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(materiaId, dia, entrada, salida, comision, docenteId).lastInsertRowid
}

export function seedTutor(db, { nombre = 'Pedro', apellido = 'Pérez', dni = '30000000' } = {}) {
  return db.prepare(
    'INSERT INTO tutores (nombre, apellido, dni_hash, dni_cif, telefono) VALUES (?, ?, ?, ?, ?)'
  ).run(nombre, apellido, `hash_${dni}`, encrypt(dni), '1234-5678').lastInsertRowid
}

export function seedAlumnoTutor(db, { alumnoId, tutorId, parentesco = 'Padre', esPrincipal = 1 } = {}) {
  db.prepare(
    'INSERT INTO alumnos_tutores (alumno_id, tutor_id, parentesco, es_principal) VALUES (?, ?, ?, ?)'
  ).run(alumnoId, tutorId, parentesco, esPrincipal)
}

export function seedAsistencia(db, { alumnoId, materiaId, fecha, estado = 'Presente', motivo = null } = {}) {
  return db.prepare(
    'INSERT INTO asistencias (alumno_id, materia_id, fecha, estado, motivo) VALUES (?, ?, ?, ?, ?)'
  ).run(alumnoId, materiaId, fecha, estado, motivo).lastInsertRowid
}

export function seedPreceptor(db, { nombre = 'Carlos', apellido = 'García', username = 'test', password = 'test123' } = {}) {
  const bcrypt = { hashSync: (s) => `hash_${s}` }
  return db.prepare(
    `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(nombre, apellido, `hash_${username}`, `enc_${username}`, '1234-5678', username, bcrypt.hashSync(password)).lastInsertRowid
}

export function seedDocente(db, { nombre = 'Roberto', apellido = 'Fernández', estado = 'Disponible' } = {}) {
  return db.prepare(
    'INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, correo, telefono, estado) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(nombre, apellido, `hash_${nombre}`, `enc_${nombre}`, `${nombre.toLowerCase()}@escuela.edu`, '1234-5678', estado).lastInsertRowid
}
