import bcrypt from 'bcryptjs'
import db from './db/index.js'
import { encrypt } from './utils/crypto.js'

const PRECEPTORES_BASE = [
  { nombre: 'Carlos', apellido: 'Gutiérrez', dni: '11111111', telefono: '1234-5678', username: 'admin', password: 'admin123', turno: null },
  { nombre: 'María', apellido: 'López', dni: '22222222', telefono: '2345-6789', username: 'preceptor1', password: 'preceptor123', turno: 'Tarde' },
  { nombre: 'Juan', apellido: 'Martínez', dni: '33333333', telefono: '3456-7890', username: 'preceptor2', password: 'preceptor123', turno: 'Mañana' },
  { nombre: 'Lucía', apellido: 'Fernández', dni: '44444444', telefono: '4567-8901', username: 'preceptor3', password: 'preceptor123', turno: 'Noche' },
]

// Inserta/actualiza preceptores de forma idempotente por username.
// Con SEED_DEMO=false y SEED_PRECEPTORES se usan credenciales reales sin demo.
async function asegurarPreceptores(lista) {
  for (const u of lista) {
    if (!u.username || !u.password || !u.nombre || !u.apellido || !u.telefono) {
      throw new Error('[seed] Cada preceptor debe incluir username, password, nombre, apellido y telefono')
    }
    if (!u.dni) {
      throw new Error('[seed] Cada preceptor debe incluir un dni numérico')
    }
  }
  const hashes = {}
  for (const u of lista) {
    if (!(u.password in hashes)) {
      hashes[u.password] = await bcrypt.hash(u.password, 12)
    }
  }
  const tx = db.transaction(() => {
    const insert = db.prepare(
      `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash, turno)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const updateTurno = db.prepare('UPDATE preceptores SET turno = ? WHERE username = ?')
    for (const u of lista) {
      const existente = db.prepare('SELECT preceptor_id, turno FROM preceptores WHERE username = ?').get(u.username)
      if (existente) {
        if (existente.turno !== u.turno) updateTurno.run(u.turno, u.username)
      } else {
        insert.run(u.nombre, u.apellido, encrypt(u.dni), encrypt(u.dni), u.telefono, u.username, hashes[u.password], u.turno)
      }
    }
  })
  tx()
}

export async function runSeed() {
  const count = db.prepare('SELECT COUNT(*) as c FROM preceptores').get().c
  const useSeedDemo = process.env.SEED_DEMO !== 'false'
  const preceptoresReales = process.env.SEED_PRECEPTORES

  // Modo producción (SEED_DEMO=false): nunca se siembran credenciales demo.
  if (!useSeedDemo) {
    if (count > 0) return
    if (preceptoresReales) {
      let lista
      try {
        lista = JSON.parse(preceptoresReales)
      } catch {
        throw new Error('[seed] SEED_PRECEPTORES debe ser un JSON válido: [{username,password,nombre,apellido,turno}]')
      }
      if (!Array.isArray(lista) || lista.length === 0) {
        throw new Error('[seed] SEED_PRECEPTORES debe ser un arreglo no vacío')
      }
      await asegurarPreceptores(lista)
      console.log(`[seed] preceptores reales creados desde SEED_PRECEPTORES (${lista.length})`)
    } else {
      console.log('[seed] SEED_DEMO=false y sin SEED_PRECEPTORES: no se crean credenciales demo')
    }
    return
  }

  // Asegura los preceptores base y sus turnos (idempotente por username).
  await asegurarPreceptores(PRECEPTORES_BASE)

  if (count > 0) return

  const insertCurso = db.prepare(
    'INSERT INTO cursos (anio, division, especialidad, turno) VALUES (?, ?, ?, ?)'
  )
  const insertMateria = db.prepare(
    'INSERT INTO materias (nombre_materia, especialidad, tipo, curso_id) VALUES (?, ?, ?, ?)'
  )
  const insertAlumno = db.prepare(
    'INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision) VALUES (?, ?, ?, ?, ?, ?)'
  )

  const tx = db.transaction(() => {
    const CICLO_BASICO_DIVISIONES = {
      1: ['1', '2', '5', '7'],
      2: ['1', '2', '5', '7'],
      3: ['1', '4', '5', '7'],
    }

    const cbCursos = {}
    for (const anio of Object.keys(CICLO_BASICO_DIVISIONES)) {
      cbCursos[anio] = {}
      for (const division of CICLO_BASICO_DIVISIONES[anio]) {
        cbCursos[anio][division] =
          insertCurso.run(Number(anio), division, 'Ciclo Básico', 'Mañana').lastInsertRowid
      }
    }

    const infoPlan = [
      { anio: 4, divisiones: ['5', '7', '9'], turno: null },
      { anio: 5, divisiones: ['5', '6', '7', '11'], turno: null },
      { anio: 6, divisiones: ['4', '5', '10'], turno: 'Vespertino' },
      { anio: 7, divisiones: ['2', '5', '7'], turno: 'Vespertino' },
    ]

    const cInfo = {}
    for (const grupo of infoPlan) {
      cInfo[grupo.anio] = []
      grupo.divisiones.forEach((division, idx) => {
        const turno = grupo.turno || (idx % 2 === 0 ? 'Mañana' : 'Tarde')
        cInfo[grupo.anio].push({
          id: insertCurso.run(grupo.anio, division, 'Informática', turno).lastInsertRowid,
          division,
        })
      })
    }

    const c4to5 = cInfo[4].find(c => c.division === '5').id
    const c6to4 = cInfo[6].find(c => c.division === '4').id
    const c7mo2 = cInfo[7].find(c => c.division === '2').id

    const CURRICULUM = {
      1: {
        Teoría: [
          'Matemáticas',
          'Prácticas del Lenguaje',
          'Ciencias Naturales',
          'Ciencias Sociales',
          'Inglés',
          'Educación Artística',
          'Educación Física',
        ],
        Taller: [
          'Procedimientos Técnicos',
          'Sistemas Tecnológicos',
          'Lenguajes Tecnológicos',
        ],
      },
      2: {
        Teoría: [
          'Matemáticas',
          'Prácticas del Lenguaje',
          'Físico-química',
          'Historia',
          'Biología',
          'Geografía',
          'Inglés',
          'Educación Artística',
          'Construcción de la Ciudadanía',
          'Educación Física',
        ],
        Taller: [
          'Procedimientos Técnicos',
          'Sistemas Tecnológicos',
          'Lenguajes Tecnológicos',
        ],
      },
      3: {
        Teoría: [
          'Matemáticas',
          'Prácticas del Lenguaje',
          'Físico-química',
          'Historia',
          'Biología',
          'Geografía',
          'Inglés',
          'Educación Artística',
          'Construcción de la Ciudadanía',
          'Educación Física',
        ],
        Taller: [
          'Procedimientos Técnicos',
          'Sistemas Tecnológicos',
          'Lenguajes Tecnológicos',
        ],
      },
    }

    const cursosCicloBasico = Object.entries(CICLO_BASICO_DIVISIONES).flatMap(([anio, divisiones]) =>
      divisiones.map(division => ({ anio: Number(anio), cursoId: cbCursos[anio][division] }))
    )

    for (const { anio, cursoId } of cursosCicloBasico) {
      const plan = CURRICULUM[anio]
      for (const tipo of Object.keys(plan)) {
        for (const nombre of plan[tipo]) {
          insertMateria.run(nombre, 'Ciclo Básico', tipo, cursoId)
        }
      }
    }

    const TALLERES_INF = [
      'Laboratorio de Hardware',
      'Laboratorio de Programación',
      'Laboratorio de Aplicaciones',
      'Laboratorio de Sistemas Operativos',
    ]

    const MATERIAS_INF = {
      4: {
        Teoría: [
          'Literatura',
          'Inglés',
          'Geografía',
          'Historia',
          'Educación Artística',
          'Matemáticas',
          'Educación Física',
          'Tecnología Electrónica',
          'Salud y Adolescencia',
          'Física',
          'Química',
        ],
        Taller: TALLERES_INF,
      },
      5: {
        Teoría: [
          'Literatura',
          'Inglés',
          'Geografía',
          'Historia',
          'Educación Artística',
          'Matemáticas',
          'Educación Física',
          'Teleinformática',
          'Sistemas Digitales',
        ],
        Taller: TALLERES_INF,
      },
      6: {
        Teoría: [
          'Literatura',
          'Inglés',
          'Arte',
          'Matemática Ciclo Superior',
          'Educación Física',
          'Filosofía',
          'Derecho del Trabajo',
          'Seguridad Informática',
          'Sistemas Digitales',
        ],
        Taller: TALLERES_INF,
      },
      7: {
        Teoría: [
          'Base de Datos',
          'Emprendimiento Productivo y Desarrollo Local',
        ],
        Laboratorio: [
          'Instalación, Mantenimiento y Reparación de Redes Informáticas',
          'Modelos y Sistemas',
          'Programación, Diseño e Implementación de Sistemas Computacionales',
          'Instalación, Mantenimiento y Reparación de Sistemas Computacionales',
          'Evaluación de Proyectos',
        ],
      },
    }

    for (const anio of Object.keys(MATERIAS_INF)) {
      for (const { id } of cInfo[anio]) {
        const plan = MATERIAS_INF[anio]
        for (const tipo of Object.keys(plan)) {
          for (const nombre of plan[tipo]) {
            insertMateria.run(nombre, 'Informática', tipo, id)
          }
        }
      }
    }

    const alumnos = [
      ['Lucía', 'Pérez', '90000001', cbCursos[1]['1'], 'A'],
      ['Mateo', 'García', '90000002', cbCursos[1]['1'], 'A'],
      ['Sofía', 'Rodríguez', '90000003', cbCursos[1]['1'], 'B'],
      ['Valentina', 'López', '90000004', cbCursos[1]['2'], 'A'],
      ['Santiago', 'Martínez', '90000005', cbCursos[1]['2'], 'A'],
      ['Camila', 'Fernández', '90000006', c4to5, 'A'],
      ['Diego', 'González', '90000007', c4to5, 'A'],
      ['Isabella', 'Torres', '90000008', c6to4, 'A'],
      ['Tomás', 'Díaz', '90000009', c7mo2, 'A'],
      ['Emma', 'Ruiz', '90000010', cbCursos[1]['1'], 'B'],
    ]

    for (const [n, a, dni, cid, com] of alumnos) {
      insertAlumno.run(n, a, encrypt(dni), encrypt(dni), cid, com)
    }
  })

  tx()
  console.log('[seed] datos iniciales insertados')
}