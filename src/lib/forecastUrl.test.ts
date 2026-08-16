import { describe, expect, test } from 'vitest'
import { buildForecastPath, parseForecastLocation } from './forecastUrl'

describe('shareable forecast URLs', () => {
  test('round-trips a named saved location', () => {
    const path = buildForecastPath({
      lat: 55.07421,
      lon: -1.47233,
      name: 'Seaton Sluice, Northumberland',
      locationId: 42,
    })

    expect(path).toContain('/forecast?')
    expect(parseForecastLocation(path.slice(path.indexOf('?')))).toEqual({
      lat: 55.07421,
      lon: -1.47233,
      name: 'Seaton Sluice, Northumberland',
      locationId: 42,
    })
  })

  test('supports unsaved coordinates', () => {
    const path = buildForecastPath({ lat: 50.123456, lon: -3.987654, name: 'Custom coast' })
    expect(parseForecastLocation(path.slice(path.indexOf('?')))).toEqual({
      lat: 50.12346,
      lon: -3.98765,
      name: 'Custom coast',
      locationId: null,
    })
  })

  test('rejects incomplete and out-of-range URLs', () => {
    expect(parseForecastLocation('?lat=55&lon=-1')).toBeNull()
    expect(parseForecastLocation('?name=Missing+coordinates')).toBeNull()
    expect(parseForecastLocation('?lat=&lon=&name=Blank+coordinates')).toBeNull()
    expect(parseForecastLocation('?lat=155&lon=-1&name=Invalid')).toBeNull()
    expect(parseForecastLocation('?lat=55&lon=-1&name=Invalid&locationId=nope')).toBeNull()
  })
})
