/** Fecha en formato YYYY-MM-DD según la hora LOCAL (no UTC).
 *  En Argentina (UTC-3), toISOString() adelanta el día desde las 21:00. */
export function fechaLocal(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/** Mes actual en formato YYYY-MM según hora local. */
export function mesLocal(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}`
}
