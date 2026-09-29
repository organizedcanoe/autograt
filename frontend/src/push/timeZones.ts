const UTC = 'UTC'

/** The IANA time zone this device is set to, e.g. "America/Toronto". */
export function detectTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  // Browsers name UTC differently; the backend's default is plain "UTC".
  return ['Etc/UTC', 'Etc/GMT', 'GMT'].includes(zone) ? UTC : zone
}

/**
 * The zones to choose from: UTC first (browsers often leave it out of their list), then every zone
 * the browser knows, plus the saved zone in case the browser names it differently.
 */
export function timeZoneOptions(savedZone: string): string[] {
  const zones = new Set([UTC, ...Intl.supportedValuesOf('timeZone')])
  zones.add(savedZone)
  return [...zones]
}
