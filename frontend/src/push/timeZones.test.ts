import { describe, expect, it } from 'vitest'
import { timeZoneOptions } from './timeZones'

describe('timeZoneOptions', () => {
  it('lists UTC first, then the IANA zones', () => {
    const options = timeZoneOptions('UTC')

    expect(options[0]).toBe('UTC')
    expect(options).toContain('America/Toronto')
    expect(options.filter((zone) => zone === 'UTC')).toHaveLength(1)
  })

  it('includes a saved zone the browser does not list', () => {
    expect(timeZoneOptions('America/Nowhere')).toContain('America/Nowhere')
  })
})
