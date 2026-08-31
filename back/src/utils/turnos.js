// Franjas por hora_entrada del horario (comparación lexicográfica válida por formato HH:MM).
export const FRANJAS_TURNO = [
  { turno: 'Mañana', desde: '07:50', hasta: '12:00' },
  { turno: 'Tarde', desde: '12:50', hasta: '17:00' },
  { turno: 'Noche', desde: '17:30', hasta: '22:00' },
]

export function turnoDeHora(hora) {
  const franja = FRANJAS_TURNO.find(f => hora >= f.desde && hora < f.hasta)
  return franja ? franja.turno : null
}