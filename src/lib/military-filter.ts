// US Air Force/Navy/Army callsign prefixes (publicly documented)
const MILITARY_CALLSIGN_PREFIXES = [
  'RCH', // USAF Air Mobility Command (Reach)
  'JAKE', 'SPAR', 'VENUS', 'POLO',
  'DUKE', 'SKULL', 'VIPER', 'COBRA',
  'GHOST', 'EAGLE', 'HAWK', 'FALCON',
  'TITAN', 'ATLAS', 'HERKY', // C-130 Hercules
  'RIFLE', 'SWORD', 'LANCE',
  'EXEC',  // Executive transport (VIP)
  'IRON',  // B-52
  'SONIC', 'NOBLE', 'FURY',
  'HAVOC', 'RACER', 'RANGER',
  'NATO',  // NATO AWACS
  'MAGIC', // E-3 Sentry AWACS
  'ORBIT', // Reconnaissance
  'FORTE', // RC-135 Rivet Joint
  'TOPAZ',
  // French AF
  'FAF', 'CTM', 'FNY',
  // UK RAF
  'RRR', 'ASCOT',
  // Canadian AF
  'CFC', 'CAF',
  // German AF
  'GAF',
  // Russian (public callsign patterns)
  'RFF', 'RSD',
]

// ICAO 24-bit hex ranges for known military registrations
// Source: public ICAO documentation + ADS-B Exchange filters
const MILITARY_ICAO_RANGES: Array<{ start: number; end: number; country: string }> = [
  // US Military (AF/Navy blocks)
  { start: 0xADF7C7, end: 0xAFFFFF, country: 'United States' },
  { start: 0xAE0000, end: 0xAFFFFF, country: 'United States' },
  // UK Military
  { start: 0x43C000, end: 0x43FFFF, country: 'United Kingdom' },
  // France Military
  { start: 0x3B7000, end: 0x3B7FFF, country: 'France' },
  // Germany Military
  { start: 0x3C4000, end: 0x3C4FFF, country: 'Germany' },
  // Russia Military
  { start: 0x154000, end: 0x157FFF, country: 'Russia' },
  // China Military
  { start: 0x780000, end: 0x7BFFFF, country: 'China' },
]

// Squawk codes associated with military ops
const MILITARY_SQUAWKS = ['7777', '7400', '0000']

export function isMilitaryAircraft(
  callsign: string | null,
  icao24: string,
  squawk: string | null
): boolean {
  // Check squawk
  if (squawk && MILITARY_SQUAWKS.includes(squawk)) return true

  // Check callsign prefix
  if (callsign) {
    const cs = callsign.trim().toUpperCase()
    if (MILITARY_CALLSIGN_PREFIXES.some(prefix => cs.startsWith(prefix))) return true
    // Pattern: 3-4 letter alpha prefix + digits (military format)
    if (/^[A-Z]{2,4}\d{2,4}$/.test(cs) && cs.length <= 7) {
      // Exclude common civilian patterns (e.g. AAL = American, UAL = United)
      const civilianPrefixes = ['AAL', 'UAL', 'DAL', 'SWA', 'BAW', 'DLH', 'AFR', 'KLM', 'EZY', 'RYR']
      if (!civilianPrefixes.some(p => cs.startsWith(p))) {
        // Additional check: if prefix is all-uppercase 3+ letters not in common airline list
      }
    }
  }

  // Check ICAO hex range
  try {
    const icaoInt = parseInt(icao24, 16)
    if (MILITARY_ICAO_RANGES.some(r => icaoInt >= r.start && icaoInt <= r.end)) return true
  } catch {
    // invalid hex
  }

  return false
}
