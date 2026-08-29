import { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Card } from '../components/tremor/Card'
import { BarChart } from '../components/tremor/BarChart'
import { AreaChart } from '../components/tremor/AreaChart'
import { cx } from '../components/tremor/utils'
import { IconChevron } from '../components/icons'

const COLORES_SEGMENTOS = {
  Presente: 'bg-emerald-500',
  Tarde: 'bg-amber-500',
  Justificado: 'bg-blue-500',
  Ausente: 'bg-red-500',
}

const ETIQUETAS_PERIODO = {
  dia: {
    kpiAsistencia: 'Asistencia de hoy',
    kpiAusentes: 'Ausentes hoy',
    chartCurso: 'Asistencia por curso — hoy',
    sinRegistros: 'Aún no se registró ninguna asistencia hoy.',
    sinSerie: 'Sin registros de asistencia en este período.',
  },
  semana: {
    kpiAsistencia: 'Asistencia de esta semana',
    kpiAusentes: 'Ausentes esta semana',
    chartCurso: 'Asistencia por curso — esta semana',
    sinRegistros: 'Sin registros de asistencia en la semana.',
    sinSerie: 'Sin registros de asistencia en esta semana.',
  },
  mes: {
    kpiAsistencia: 'Asistencia del mes',
    kpiAusentes: 'Ausentes del mes',
    chartCurso: 'Asistencia por curso — este mes',
    sinRegistros: 'Sin registros de asistencia en el mes.',
    sinSerie: 'Sin registros de asistencia en este mes.',
  },
}

const OPCIONES_PERIODO = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
]

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ORDINAL_ANIO = { 1: 'ro', 2: 'do', 3: 'ro', 4: 'to', 5: 'to', 6: 'to', 7: 'mo' }
const ORDINAL_DIVISION = { 1: 'ra', 2: 'da', 3: 'ra', 4: 'ta', 5: 'ta', 6: 'ta', 7: 'ma', 8: 'va', 9: 'na', 10: 'ma' }

const ordinal = (num, map, fallback) => {
  const n = Number(num)
  return map[n] ? `${n}${map[n]}` : fallback
}

const nombreCurso = c =>
  `${ordinal(c.anio, ORDINAL_ANIO, String(c.anio))} ${ordinal(c.division, ORDINAL_DIVISION, String(c.division))}`

const etiquetaDia = iso =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  })

const rangoDeDias = (desde, hasta, hoy) => {
  const fin = hasta < hoy ? hasta : hoy
  const dias = []
  let actual = desde
  while (actual <= fin) {
    dias.push(actual)
    const [y, m, d] = actual.split('-').map(Number)
    const sig = new Date(y, m - 1, d + 1)
    actual = `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, '0')}-${String(sig.getDate()).padStart(2, '0')}`
  }
  return dias
}

const contarEstados = filas =>
  filas
    .filter(f => f.estado)
    .reduce(
      (acc, f) => ({ ...acc, [f.estado]: (acc[f.estado] || 0) + 1 }),
      { Presente: 0, Tarde: 0, Justificado: 0, Ausente: 0 }
    )

function SelectorPeriodo({ valor, onChange }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={valor}
        onChange={e => onChange(e.target.value)}
        aria-label="Período de las estadísticas"
        className="appearance-none rounded-full border border-gray-200 bg-white py-1.5 pl-3.5 pr-9 text-xs font-medium text-gray-700 shadow-xs transition hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {OPCIONES_PERIODO.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      <IconChevron size={14} className="pointer-events-none absolute right-3 rotate-90 text-gray-500" />
    </div>
  )
}

function CategoryBar({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <div className="h-1.5 w-full rounded-full bg-gray-200" />
  return (
    <div className="flex h-1.5 items-center gap-0.5 overflow-hidden">
      {segments.filter(s => s.value > 0).map(s => (
        <div key={s.label} title={`${s.label}: ${s.value}`} className={cx('h-full rounded-full', s.color)} style={{ width: `${(s.value / total) * 100}%` }} />
      ))}
    </div>
  )
}

function KpiCard({ label, valor, detalle, segments }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tabular-nums text-gray-900">{valor}</p>
      {segments && <div className="mt-3"><CategoryBar segments={segments} /></div>}
      {detalle && <p className="mt-2 text-xs text-gray-500">{detalle}</p>}
    </Card>
  )
}

function SkeletonCard({ className }) {
  return (
    <div className={cx('animate-pulse rounded-lg border border-gray-200 bg-white p-6', className)}>
      <div className="h-3 w-24 rounded bg-gray-200" />
      <div className="mt-4 h-7 w-16 rounded bg-gray-200" />
      <div className="mt-5 h-1.5 w-full rounded bg-gray-100" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <Card>
      <div className="h-3.5 w-48 rounded bg-gray-200" />
      <div className="mt-8 flex h-64 items-end gap-3 pr-4">
        {[38, 62, 45, 80, 55, 70, 42].map((h, i) => (
          <div key={i} className="flex-1 animate-pulse rounded-t-md bg-gray-100" style={{ height: `${h}%` }} />
        ))}
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('dia')
  const [carga, setCarga] = useState(true)
  const [error, setError] = useState('')
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    const hoy = hoyISO()
    let cancelado = false

    async function cargar() {
      setCarga(true)
      setError('')
      try {
        const [cursosRes, alumnosRes] = await Promise.all([
          api.get('/cursos'),
          api.get('/alumnos'),
        ])

        const cursos = [...cursosRes.data].sort((a, b) => {
          const turnoOrd = { Mañana: 0, Tarde: 1, Vespertino: 2, Noche: 3 }
          const ta = turnoOrd[a.turno] ?? 9
          const tb = turnoOrd[b.turno] ?? 9
          if (ta !== tb) return ta - tb
          return a.anio - b.anio || (a.division || '').localeCompare(b.division || '')
        })

        const reportes = await Promise.all(
          cursos.map(curso =>
            api.get('/reportes', {
              params: { curso_id: curso.curso_id, tipo: periodo, fecha: hoy },
            }).then(r => r.data)
          )
        )

        const porCurso = cursos.map((curso, i) => ({
          id: curso.curso_id,
          nombre: nombreCurso(curso),
          turno: curso.turno,
          ...contarEstados(reportes[i].detalle),
        }))

        const { desde, hasta } = reportes[0] || {}
        const acumulado = {}
        for (const rep of reportes) {
          for (const fila of rep.detalle) {
            if (!fila.fecha) continue
            const bucket = (acumulado[fila.fecha] ||= { asistencias: 0, ausencias: 0 })
            if (fila.estado === 'Ausente') bucket.ausencias += 1
            else bucket.asistencias += 1
          }
        }
        const serieMensual =
          desde && hasta
            ? rangoDeDias(desde, hasta, hoy).map(fecha => ({
                dia: etiquetaDia(fecha),
                Asistencias: acumulado[fecha]?.asistencias ?? 0,
                Ausencias: acumulado[fecha]?.ausencias ?? 0,
              }))
            : []

        if (!cancelado) {
          setDatos({ hoy, porCurso, serieMensual, alumnosActivos: alumnosRes.data.length })
        }
      } catch (err) {
        if (!cancelado) setError(err.response?.data?.error || 'Error al cargar estadísticas')
      } finally {
        if (!cancelado) setCarga(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [periodo])

  const vista = useMemo(() => {
    if (!datos) return null
    const totales = datos.porCurso.reduce(
      (acc, c) => ({
        Presente: acc.Presente + c.Presente,
        Tarde: acc.Tarde + c.Tarde,
        Justificado: acc.Justificado + c.Justificado,
        Ausente: acc.Ausente + c.Ausente,
      }),
      { Presente: 0, Tarde: 0, Justificado: 0, Ausente: 0 }
    )
    const marcados = totales.Presente + totales.Tarde + totales.Justificado + totales.Ausente
    const noAusentes = marcados - totales.Ausente
    const pct = marcados > 0 ? Math.round((noAusentes / marcados) * 100) : null
    return { totales, marcados, pct }
  }, [datos])

  const etiquetas = ETIQUETAS_PERIODO[periodo]
  const serieConDatos = datos?.serieMensual.some(d => d.Asistencias > 0 || d.Ausencias > 0)
  const rangoSerie = datos && datos.serieMensual.length > 0
    ? `${datos.serieMensual[0].dia} al ${datos.serieMensual[datos.serieMensual.length - 1].dia}`
    : ''

  return (
    <section className="space-y-5">
      <header className="m-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Panel</h1>
        <SelectorPeriodo valor={periodo} onChange={setPeriodo} />
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {carga || !vista ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
          <SkeletonChart />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label={etiquetas.kpiAsistencia}
              valor={vista.pct === null ? '—' : `${vista.pct}%`}
              segments={[
                { label: 'Presentes', value: vista.totales.Presente, color: COLORES_SEGMENTOS.Presente },
                { label: 'Ausentes', value: vista.totales.Ausente, color: COLORES_SEGMENTOS.Ausente },
                { label: 'Tardanzas', value: vista.totales.Tarde, color: COLORES_SEGMENTOS.Tarde },
                { label: 'Justificados', value: vista.totales.Justificado, color: COLORES_SEGMENTOS.Justificado },
              ]}
              detalle={vista.marcados > 0 ? `${vista.marcados} registros` : 'Sin registros'}
            />
            <KpiCard
              label={etiquetas.kpiAusentes}
              valor={vista.totales.Ausente}
              detalle={vista.totales.Ausente === 0 && vista.marcados > 0 ? 'Ninguna ausencia' : 'Del total del período'}
            />
            <KpiCard
              label="Alumnos activos"
              valor={datos.alumnosActivos}
              detalle={`En ${datos.porCurso.length} cursos`}
            />
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-gray-900">{etiquetas.chartCurso}</h3>
                <p className="mt-0.5 text-xs text-gray-500">Barras agrupadas por estado</p>
              </div>
              {vista.marcados > 0 && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{vista.marcados} registros</span>
              )}
            </div>
            {vista.marcados > 0 ? (
              <BarChart
                data={datos.porCurso.map(c => ({
                  curso: c.nombre,
                  Presentes: c.Presente,
                  Tardanzas: c.Tarde,
                  Justificados: c.Justificado,
                  Ausentes: c.Ausente,
                }))}
                index="curso"
                categories={['Presentes', 'Tardanzas', 'Justificados', 'Ausentes']}
                colors={['emerald', 'amber', 'blue', 'red']}
                type="default"
                enableLegendSlider
                yAxisWidth={32}
                allowDecimals={false}
                tickGap={10}
                className="mt-4 h-72"
              />
            ) : (
              <p className="py-16 text-center text-sm text-gray-400">{etiquetas.sinRegistros}</p>
            )}
          </Card>

          {periodo !== 'dia' && (
            <Card>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Asistencias vs Ausencias totales</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Todos los cursos{rangoSerie && ` · ${rangoSerie}`}
                </p>
              </div>
              {serieConDatos ? (
                <AreaChart
                  data={datos.serieMensual}
                  index="dia"
                  categories={['Asistencias', 'Ausencias']}
                  colors={['emerald', 'red']}
                  fill="gradient"
                  yAxisWidth={32}
                  allowDecimals={false}
                  tickGap={14}
                  className="mt-4 h-72"
                />
              ) : (
                <p className="py-16 text-center text-sm text-gray-400">{etiquetas.sinSerie}</p>
              )}
            </Card>
          )}
        </>
      )}
    </section>
  )
}
