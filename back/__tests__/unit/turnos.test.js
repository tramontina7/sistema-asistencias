import { describe, it, expect } from 'vitest'
import { turnoDeHora } from '../../src/utils/turnos.js'

describe('turnos', () => {
  it('asigna Mañana antes de las 12:00', () => {
    expect(turnoDeHora('00:00')).toBe('Mañana')
    expect(turnoDeHora('06:30')).toBe('Mañana')
    expect(turnoDeHora('11:59')).toBe('Mañana')
  })

  it('asigna Tarde entre 12:00 y antes de las 18:00', () => {
    expect(turnoDeHora('12:00')).toBe('Tarde')
    expect(turnoDeHora('13:30')).toBe('Tarde')
    expect(turnoDeHora('17:59')).toBe('Tarde')
  })

  it('asigna Noche desde las 18:00', () => {
    expect(turnoDeHora('18:00')).toBe('Noche')
    expect(turnoDeHora('22:15')).toBe('Noche')
    expect(turnoDeHora('23:59')).toBe('Noche')
  })
})