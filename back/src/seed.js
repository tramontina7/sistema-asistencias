import bcrypt from 'bcryptjs'
import db from './db/index.js'
import { encrypt } from './utils/crypto.js'

export async function runSeed() {
  const count = db.prepare('SELECT COUNT(*) as c FROM preceptores').get().c
  if (count > 0) return

  const preceptorHash = await bcrypt.hash('preceptor123', 12)
  const adminHash = await bcrypt.hash('admin123', 12)

  const insertPreceptor = db.prepare(
    `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const insertDocente = db.prepare(
    'INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, correo, telefono) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insertTutor = db.prepare(
    'INSERT INTO tutores (nombre, apellido, dni_hash, dni_cif, telefono) VALUES (?, ?, ?, ?, ?)'
  )
  const insertCurso = db.prepare(
    'INSERT INTO cursos (anio, division, especialidad, turno) VALUES (?, ?, ?, ?)'
  )
  const insertMateria = db.prepare(
    'INSERT INTO materias (nombre_materia, especialidad, tipo, curso_id, docente_id) VALUES (?, ?, ?, ?, ?)'
  )
  const insertAlumno = db.prepare(
    'INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insertPreceptorCurso = db.prepare(
    'INSERT INTO preceptores_cursos (preceptor_id, curso_id) VALUES (?, ?)'
  )
  const insertAlumnoTutor = db.prepare(
    'INSERT INTO alumnos_tutores (alumno_id, tutor_id, parentesco, es_principal) VALUES (?, ?, ?, ?)'
  )

  const tx = db.transaction(() => {
    const p1 = insertPreceptor.run('Carlos', 'Gutiérrez', encrypt('11111111'), encrypt('11111111'), '1234-5678', 'admin', adminHash)
    const p2 = insertPreceptor.run('María', 'López', encrypt('22222222'), encrypt('22222222'), '2345-6789', 'preceptor1', preceptorHash)
    const p3 = insertPreceptor.run('Juan', 'Martínez', encrypt('33333333'), encrypt('33333333'), '3456-7890', 'preceptor2', preceptorHash)

const d1 = insertDocente.run('Roberto', 'Fernández', encrypt('44444444'), encrypt('44444444'), 'rf@escuela.edu', '4567-8901')
    const d2 = insertDocente.run('Ana', 'García', encrypt('55555555'), encrypt('55555555'), 'ag@escuela.edu', '5678-9012')
    const d3 = insertDocente.run('Luis', 'Rodríguez', encrypt('66666666'), encrypt('66666666'), 'lr@escuela.edu', '6789-0123')

    const t1 = insertTutor.run('Pedro', 'Pérez', encrypt('77777777'), encrypt('77777777'), '7890-1234')
    const t2 = insertTutor.run('Laura', 'Sánchez', encrypt('88888888'), encrypt('88888888'), '8901-2345')

    const insertCompetencia = db.prepare(
      'INSERT INTO docente_materias (docente_id, nombre_materia) VALUES (?, ?)'
    )
    const competencias = {
      [d1.lastInsertRowid]: [
        'Laboratorio de Hardware',
        'Laboratorio de Programación',
        'Laboratorio de Aplicaciones',
        'Laboratorio de Sistemas Operativos',
        'Base de Datos',
        'Teleinformática',
        'Sistemas Digitales',
        'Seguridad Informática',
        'Instalación, Mantenimiento y Reparación de Redes Informáticas',
        'Modelos y Sistemas',
        'Programación, Diseño e Implementación de Sistemas Computacionales',
        'Instalación, Mantenimiento y Reparación de Sistemas Computacionales',
        'Evaluación de Proyectos',
      ],
      [d2.lastInsertRowid]: [
        'Matemáticas',
        'Matemática Ciclo Superior',
        'Física',
        'Química',
        'Físico-química',
        'Biología',
        'Ciencias Naturales',
        'Tecnología Electrónica',
      ],
      [d3.lastInsertRowid]: [
        'Literatura',
        'Inglés',
        'Geografía',
        'Historia',
        'Educación Artística',
        'Arte',
        'Filosofía',
        'Salud y Adolescencia',
        'Derecho del Trabajo',
        'Emprendimiento Productivo y Desarrollo Local',
        'Prácticas del Lenguaje',
        'Construcción de la Ciudadanía',
      ],
    }
    for (const [docenteId, materias] of Object.entries(competencias)) {
      for (const nombre of materias) insertCompetencia.run(docenteId, nombre)
    }

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

    insertPreceptorCurso.run(p2.lastInsertRowid, cbCursos[1]['1'])
    insertPreceptorCurso.run(p2.lastInsertRowid, cbCursos[1]['2'])

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
          insertMateria.run(nombre, 'Ciclo Básico', tipo, cursoId, null)
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
            insertMateria.run(nombre, 'Informática', tipo, id, null)
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

    const alumnoIds = alumnos.map(([n, a, dni, cid, com]) =>
      insertAlumno.run(n, a, encrypt(dni), encrypt(dni), cid, com).lastInsertRowid
    )

    insertAlumnoTutor.run(alumnoIds[0], t1.lastInsertRowid, 'Madre', 1)
    insertAlumnoTutor.run(alumnoIds[0], t2.lastInsertRowid, 'Padre', 0)
    insertAlumnoTutor.run(alumnoIds[1], t1.lastInsertRowid, 'Padre', 1)
  })

  tx()
  console.log('[seed] datos iniciales insertados')
}
