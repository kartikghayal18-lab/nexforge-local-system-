export interface PasswordGeneratorOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

export const DEFAULT_GENERATOR_OPTIONS: PasswordGeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
}

const SETS = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  symbols: '!@#$%^&*()-_=+[]{}',
}

export function generatePassword(opts: PasswordGeneratorOptions = DEFAULT_GENERATOR_OPTIONS): string {
  const pools: string[] = []
  if (opts.uppercase) pools.push(SETS.uppercase)
  if (opts.lowercase) pools.push(SETS.lowercase)
  if (opts.numbers) pools.push(SETS.numbers)
  if (opts.symbols) pools.push(SETS.symbols)
  if (pools.length === 0) pools.push(SETS.lowercase)

  const alphabet = pools.join('')
  const length = Math.max(opts.length, pools.length)
  const randomBytes = new Uint32Array(length)
  crypto.getRandomValues(randomBytes)

  const chars: string[] = []
  // Guarantee at least one char from each selected pool.
  pools.forEach((pool, i) => {
    chars.push(pool[randomBytes[i] % pool.length])
  })
  for (let i = pools.length; i < length; i++) {
    chars.push(alphabet[randomBytes[i] % alphabet.length])
  }
  // Shuffle (Fisher-Yates) using crypto randomness.
  const shuffleBytes = new Uint32Array(chars.length)
  crypto.getRandomValues(shuffleBytes)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
