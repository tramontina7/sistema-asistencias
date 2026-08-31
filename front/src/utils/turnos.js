// Franjas por hora_entrada del horario (comparación lexicográfica válida por formato HH:MM).
export const FRANJAS_TURNO = [
  { turno: 'Mañana', desde: '00:00', hasta: '12:00' },
  { turno: 'Tarde', desde: '12:00', hasta: '18:00' },
  { turno: 'Noche', desde: '18:00', hasta: '24:00' },
]

export const turnoDeHora = hora => {
  const franja = FRANJAS_TURNO.find(f => hora >= f.desde && hora < f.hasta)
  return franja ? franja.turno : null
}