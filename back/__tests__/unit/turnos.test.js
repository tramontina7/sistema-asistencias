import { describe, it, expect } from 'vitest'
import { turnoDeHora } from '../../src/utils/turnos.js'

describe('turnos', () => {
  it('asigna Mañana entre 07:50 y antes de las 12:00', () => {
    expect(turnoDeHora('07:50')).toBe('Mañana')
    expect(turnoDeHora('09:00')).toBe('Mañana')
    expect(turnoDeHora('11:59')).toBe('Mañana')
  })

  it('asigna Tarde entre 12:50 y antes de las 17:00', () => {
    expect(turnoDeHora('12:50')).toBe('Tarde')
    expect(turnoDeHora('15:30')).toBe('Tarde')
    expect(turnoDeHora('16:59')).toBe('Tarde')
  })

  it('asigna Noche entre 17:30 y antes de las 22:00', () => {
    expect(turnoDeHora('17:30')).toBe('Noche')
    expect(turnoDeHora('20:00')).toBe('Noche')
    expect(turnoDeHora('21:59')).toBe('Noche')
  })

  it('devuelve null fuera de las franjas horarias', () => {
    expect(turnoDeHora('06:00')).toBeNull()
    expect(turnoDeHora('12:00')).toBeNull()
    expect(turnoDeHora('17:15')).toBeNull()
    expect(turnoDeHora('22:15')).toBeNull()
    expect(turnoDeHora('00:00')).toBeNull()
  })
})