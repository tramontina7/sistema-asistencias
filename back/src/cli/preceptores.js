import { createInterface } from 'node:readline/promises'
import { runSchema } from '../schema.js'
import { preceptorService } from '../services/preceptorService.js'
import { closeDb } from '../db/close.js'

const SUBCOMANDOS = ['crear', 'listar', 'editar', 'desactivar', 'reactivar', 'eliminar', 'help']

function parseArgs(args) {
  const out = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = args[i + 1]
      if (value !== undefined && !value.startsWith('--')) {
        out[key] = value
        i++
      } else {
        out[key] = true
      }
    } else {
      out._positional = out._positional || []
      out._positional.push(arg)
    }
  }
  return out
}

function numero(valor) {
  const n = Number(valor)
  return Number.isInteger(n) ? n : valor
}

function mostrarTabla(preceptor) {
  if (!preceptor) return
  const estado = preceptor.activo === 0 ? '(desactivado)' : '(activo)'
  console.log(
    `[${preceptor.preceptor_id}] ${preceptor.username} · ${preceptor.apellido}, ${preceptor.nombre} · turno: ${preceptor.turno || '—'} · ${estado}`
  )
}

function crear(args) {
  const { username, password, nombre, apellido, dni, telefono, turno } = args
  const creado = preceptorService.create({ username, password, nombre, apellido, dni, telefono, turno })
  console.log(`[ok] preceptor creado`)
  mostrarTabla(creado)
}

function listar() {
  const lista = preceptorService.list()
  if (lista.length === 0) {
    console.log('[info] no hay preceptores registrados')
    return
  }
  console.log(`[info] ${lista.length} preceptores:`)
  for (const p of lista) mostrarTabla(p)
}

function editar(args) {
  const [identificadorRaw] = args._positional || []
  if (!identificadorRaw) {
    throw new Error('Uso: editar <id|username> [--nombre ...] [--apellido ...] [--dni ...] [--telefono ...] [--turno ...] [--password ...]')
  }
  const identificador = numero(identificadorRaw)
  const { nombre, apellido, dni, telefono, turno, password } = args
  const actualizado = preceptorService.update(identificador, { nombre, apellido, dni, telefono, turno, password })
  console.log(`[ok] preceptor actualizado`)
  mostrarTabla(actualizado)
}

function desactivar(args) {
  const [identificadorRaw] = args._positional || []
  if (!identificadorRaw) throw new Error('Uso: desactivar <id|username>')
  const identificador = numero(identificadorRaw)
  const actualizado = preceptorService.setActivo(identificador, false)
  console.log(`[ok] preceptor desactivado`)
  mostrarTabla(actualizado)
}

function reactivar(args) {
  const [identificadorRaw] = args._positional || []
  if (!identificadorRaw) throw new Error('Uso: reactivar <id|username>')
  const identificador = numero(identificadorRaw)
  const actualizado = preceptorService.setActivo(identificador, true)
  console.log(`[ok] preceptor reactivado`)
  mostrarTabla(actualizado)
}

async function eliminar(args) {
  const [identificadorRaw] = args._positional || []
  if (!identificadorRaw) throw new Error('Uso: eliminar <id|username>')
  const identificador = numero(identificadorRaw)

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const respuesta = (await rl.question(
    `¿Eliminar definitivamente al preceptor '${identificadorRaw}'? Operación irreversible (s/N): `
  )).trim().toLowerCase()
  rl.close()

  if (!['s', 'si', 'sí', 'y', 'yes'].includes(respuesta)) {
    console.log('[info] operación cancelada')
    return
  }

  const eliminado = preceptorService.remove(identificador)
  console.log('[ok] preceptor eliminado')
  mostrarTabla(eliminado)
}

function help() {
  console.log(`
Gestión de preceptores

Uso: node src/cli/preceptores.js <subcomando> [opciones]

Subcomandos:
  crear     Crea un preceptor nuevo.
            --username   nombre de usuario (obligatorio)
            --password   contraseña (obligatorio)
            --nombre     nombre (obligatorio)
            --apellido   apellido (obligatorio)
            --dni        número de DNI (obligatorio)
            --telefono   teléfono (obligatorio)
            --turno      Mañana | Tarde | Noche (opcional)

  listar    Lista todos los preceptores.

  editar    Modifica un preceptor (acepta id o username como primer argumento).
            Campos opcionales: --nombre --apellido --dni --telefono --turno --password

  desactivar  Desactiva el acceso de un preceptor (id o username). Invalida su token al instante.
  reactivar   Reactiva el acceso de un preceptor (id o username).
  eliminar    Elimina definitivamente un preceptor (id o username). Pide confirmación.

Ejemplos:
  node src/cli/preceptores.js crear --username jperez --password Cambiar123! --nombre Juan --apellido Perez --dni 12345678 --telefono 11-2345-6789 --turno Tarde
  node src/cli/preceptores.js listar
  node src/cli/preceptores.js editar jperez --turno Noche --password NuevaPass123
  node src/cli/preceptores.js desactivar jperez
  node src/cli/preceptores.js reactivar 5
  node src/cli/preceptores.js eliminar 5
`)
}

async function main() {
  await runSchema()

  const [subcomando, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)

  try {
    switch (subcomando) {
      case 'crear': crear(args); break
      case 'listar': listar(); break
      case 'editar': editar(args); break
      case 'desactivar': desactivar(args); break
      case 'reactivar': reactivar(args); break
      case 'eliminar': await eliminar(args); break
      case 'help': help(); break
      case undefined: help(); break
      default:
        throw new Error(`Subcomando desconocido: '${subcomando}'. Use 'help' para ver las opciones.`)
    }
  } catch (err) {
    console.error(`[error] ${err.message}`)
    process.exitCode = 1
  } finally {
    closeDb()
  }
}

main()
