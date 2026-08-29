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
  `)
  db.pragma('foreign_keys = ON')

  const tx = db.transaction(() => {
    db.exec(`
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
        hora_salida  TEXT NOT NULL CHECK(hora_salida LIKE '__:__' AND hora_salida > hora_entrada)
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
    `)

    // Migración: pasar docente_suplencias de clave (materia_id) a (materia_id, comision)
    // Se ejecuta una sola vez controlado por PRAGMA user_version.
    const version = db.pragma('user_version', { simple: true })

    if (version < 1) {
      const cols = db.prepare('PRAGMA table_info(docente_suplencias)').all().map(c => c.name)
      const esAntigua = cols.includes('materia_id') && !cols.includes('comision')
      if (esAntigua) {
        db.pragma('foreign_keys = OFF')
        db.exec(`
          CREATE TABLE docente_suplencias_new (
            materia_id          INTEGER NOT NULL REFERENCES materias(materia_id) ON DELETE CASCADE,
            comision            TEXT NULL,
            suplente_docente_id INTEGER NOT NULL REFERENCES docentes(docente_id) ON DELETE CASCADE,
            PRIMARY KEY (materia_id, comision)
          );
        `)
        db.prepare(
          `INSERT INTO docente_suplencias_new (materia_id, comision, suplente_docente_id)
           SELECT materia_id, NULL, suplente_docente_id FROM docente_suplencias`
        ).run()
        db.exec('DROP TABLE docente_suplencias')
        db.exec('ALTER TABLE docente_suplencias_new RENAME TO docente_suplencias')
        db.pragma('foreign_keys = ON')
      }
      db.pragma('user_version = 1')
    }

    // Migración v2: normalizar comisiones a valores fijos 'A'/'B'.
    if (db.pragma('user_version', { simple: true }) < 2) {
      db.pragma('foreign_keys = OFF')
      for (const tbl of ['materia_comisiones', 'docente_suplencias']) {
        const cols = db.prepare(`PRAGMA table_info(${tbl})`).all().map(c => c.name)
        if (!cols.includes('comision')) continue
        const update = db.prepare(`UPDATE ${tbl} SET comision = ? WHERE comision = ?`)
        update.run('A', 'Comisión A')
        update.run('B', 'Comisión B')
      }
      db.pragma('foreign_keys = ON')
      db.pragma('user_version = 2')
    }

    // Migración v3: añadir comision y docente_id a horarios para soportar
    // talleres/laboratorios con comisiones (A/B) y docente por bloque.
    if (db.pragma('user_version', { simple: true }) < 3) {
      db.pragma('foreign_keys = OFF')
      const horCols = db.prepare('PRAGMA table_info(horarios)').all().map(c => c.name)
      if (!horCols.includes('comision')) {
        db.exec('ALTER TABLE horarios ADD COLUMN comision TEXT NULL')
      }
      if (!horCols.includes('docente_id')) {
        db.exec('ALTER TABLE horarios ADD COLUMN docente_id INTEGER REFERENCES docentes(docente_id) ON DELETE SET NULL')
      }
      db.pragma('foreign_keys = ON')
      db.pragma('user_version = 3')
    }
  })

  tx()
  console.log('[schema] esquema creado/verificado')
}
