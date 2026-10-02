import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

/**
 * Snapshot del esquema que la app declara en schema.js.
 *
 * Este archivo es la unica fuente INDEPENDIENTE del esquema. Los tests unit
 * crean su base con runSchema() real, asi que un cambio en schema.js se
 * refleja automaticamente y no seria detectado comparando el esquema contra si
 * mismo. Este snapshot congela las columnas esperadas: si schema.js cambia y
 * este archivo no, el test falla y obliga a decidir consciously.
 *
 * Cuando agregues o modifiques una columna en schema.js, actualiza la tabla de
 * abajo en el mismo commit.
 */

/** Tabla -> columnas, en el mismo formato que devuelve PRAGMA table_info. */
export const ESQUEMA_ESPERADO = {
  preceptores: [
    'activo', 'apellido', 'dni_cif', 'dni_hash', 'nombre', 'password_hash',
    'preceptor_id', 'telefono', 'turno', 'username',
  ],
  cursos: [
    'anio', 'curso_id', 'division', 'especialidad', 'turno',
  ],
  alumnos: [
    'alumno_id', 'apellido', 'comision', 'curso_id', 'dni_cif', 'dni_hash',
    'nombre', 'qr_token_hash',
  ],
  materias: [
    'curso_id', 'especialidad', 'materia_id', 'nombre_materia', 'tipo',
  ],
  horarios: [
    'comision', 'dia_semana', 'hora_entrada', 'hora_salida', 'horario_id',
    'materia_id',
  ],
  materia_comisiones: [
    'comision', 'materia_comision_id', 'materia_id',
  ],
  asistencias: [
    'alumno_id', 'asistencia_id', 'estado', 'fecha', 'hora_ingreso', 'materia_id',
    'motivo', 'motivo_tarde',
  ],
}

/** DDL base tal como lo aplica la app (sin las migraciones). */
export function ddlDeLaApp() {
  const fuente = fs.readFileSync(path.resolve('src/schema.js'), 'utf8')
  // schema.js tiene varios db.exec(`...`): uno de DROP de tablas legacy, el del
  // DDL que queremos y los de las migraciones. Se elige el bloque que contiene
  // las CREATE TABLE, no el primero.
  const bloques = [...fuente.matchAll(/db\.exec\(`([\s\S]*?)`\)/g)].map(m => m[1])
  const ddl = bloques.find(b => b.includes('CREATE TABLE IF NOT EXISTS'))
  if (!ddl) throw new Error('[esquema] no se encontro el bloque de CREATE TABLE en schema.js')
  return ddl
}

/** Columnas reales de una tabla, leidas con PRAGMA sobre el DDL de la app. */
export function columnasReales(db, tabla) {
  return db.prepare(`PRAGMA table_info(${tabla})`).all().map(c => c.name).sort()
}

/** BD en memoria con el DDL de la app aplicado. */
export function bdConEsquemaDeLaApp() {
  const db = new Database(':memory:')
  db.exec(ddlDeLaApp())
  return db
}
