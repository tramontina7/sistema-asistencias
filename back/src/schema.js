import db from './db/index.js'

export function runSchema() {
  db.pragma('foreign_keys = OFF')
  // Solo se purgan tablas legacy que ya no usa la app.
  db.exec(`
    DROP TABLE IF EXISTS usuarios;
    DROP TABLE IF EXISTS usuario_cursos;
    DROP TABLE IF EXISTS turnos;
    DROP TABLE IF EXISTS jornadas;
    DROP TABLE IF EXISTS horario_materias;
    DROP TABLE IF EXISTS alumno_materias;
    DROP TABLE IF EXISTS asistencias_materia;
    DROP TABLE IF EXISTS alertas;
    DROP TABLE IF EXISTS schema_migrations;
    DROP TABLE IF EXISTS horarios_dev;
    DROP TABLE IF EXISTS previas;
    DROP TABLE IF EXISTS retiros;
    DROP TABLE IF EXISTS tutores;
    DROP TABLE IF EXISTS alumnos_tutores;
    DROP TABLE IF EXISTS docentes;
    DROP TABLE IF EXISTS docente_materias;
    DROP TABLE IF EXISTS docente_suplencias;
    DROP TABLE IF EXISTS docente_ausencias;
    DROP TABLE IF EXISTS preceptores_cursos;
  `)
  db.pragma('foreign_keys = ON')

  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS preceptores (
        preceptor_id  INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre        TEXT NOT NULL,
        apellido      TEXT NOT NULL,
        dni_hash      TEXT NOT NULL UNIQUE,
        dni_cif       TEXT NOT NULL,
        telefono      TEXT NOT NULL,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        turno         TEXT CHECK(turno IS NULL OR turno IN ('Mañana', 'Tarde', 'Noche')),
        activo        INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS cursos (
        curso_id     INTEGER PRIMARY KEY AUTOINCREMENT,
        anio         INTEGER NOT NULL CHECK(anio BETWEEN 1 AND 7),
        division     TEXT NOT NULL CHECK(length(division) > 0),
        especialidad TEXT NOT NULL,
        turno        TEXT NOT NULL CHECK(turno IN ('Mañana', 'Tarde', 'Vespertino', 'Noche')),
        UNIQUE(anio, division, especialidad, turno)
      );

      CREATE TABLE IF NOT EXISTS alumnos (
        alumno_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre      TEXT NOT NULL,
        apellido    TEXT NOT NULL,
        dni_hash    TEXT NOT NULL UNIQUE,
        dni_cif     TEXT NOT NULL,
        curso_id        INTEGER NOT NULL REFERENCES cursos(curso_id) ON DELETE RESTRICT,
        comision        TEXT NOT NULL CHECK(length(comision) > 0),
        qr_token_hash   TEXT NULL
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
    `)

    // Migración v4: quitar columnas de docentes (módulo eliminado).
    // Se ejecuta una sola vez controlado por PRAGMA user_version.
    if (db.pragma('user_version', { simple: true }) < 4) {
      db.pragma('foreign_keys = OFF')
      for (const tbl of ['materias', 'horarios', 'materia_comisiones']) {
        const cols = db.prepare(`PRAGMA table_info(${tbl})`).all().map(c => c.name)
        if (cols.includes('docente_id')) {
          db.exec(`ALTER TABLE ${tbl} DROP COLUMN docente_id`)
        }
      }
      db.pragma('foreign_keys = ON')
      db.pragma('user_version = 4')
    }

    // Migración v5: asignar turno a los preceptores (Mañana/Tarde/Noche).
    if (db.pragma('user_version', { simple: true }) < 5) {
      const cols = db.prepare('PRAGMA table_info(preceptores)').all().map(c => c.name)
      if (!cols.includes('turno')) {
        db.exec(
          `ALTER TABLE preceptores ADD COLUMN turno TEXT
           CHECK(turno IS NULL OR turno IN ('Mañana', 'Tarde', 'Noche'))`
        )
      }
      db.pragma('user_version = 5')
    }

    // Migración v6: columna hora_ingreso en asistencias (registro de llegadas tarde).
    if (db.pragma('user_version', { simple: true }) < 6) {
      const cols = db.prepare('PRAGMA table_info(asistencias)').all().map(c => c.name)
      if (!cols.includes('hora_ingreso')) {
        db.exec('ALTER TABLE asistencias ADD COLUMN hora_ingreso TEXT NULL')
      }
      db.pragma('user_version = 6')
    }

    // Migración v7: columna motivo_tarde (motivo opcional de las llegadas tarde).
    if (db.pragma('user_version', { simple: true }) < 7) {
      const cols = db.prepare('PRAGMA table_info(asistencias)').all().map(c => c.name)
      if (!cols.includes('motivo_tarde')) {
        db.exec('ALTER TABLE asistencias ADD COLUMN motivo_tarde TEXT NULL')
      }
      db.pragma('user_version = 7')
    }

    // Migración v8: hash del token QR vigente de cada alumno (rotación).
    if (db.pragma('user_version', { simple: true }) < 8) {
      const cols = db.prepare('PRAGMA table_info(alumnos)').all().map(c => c.name)
      if (!cols.includes('qr_token_hash')) {
        db.exec('ALTER TABLE alumnos ADD COLUMN qr_token_hash TEXT NULL')
      }
      db.pragma('user_version = 8')
    }

    // Migración v9: campo activo en preceptores (permitir desactivación sin borrado).
    if (db.pragma('user_version', { simple: true }) < 9) {
      const cols = db.prepare('PRAGMA table_info(preceptores)').all().map(c => c.name)
      if (!cols.includes('activo')) {
        db.exec('ALTER TABLE preceptores ADD COLUMN activo INTEGER NOT NULL DEFAULT 1')
      }
      db.pragma('user_version = 9')
    }
  })

  tx()
  console.log('[schema] esquema creado/verificado')
}