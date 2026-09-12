export interface EnvPresetVar {
  key: string
  category: string
}

export interface EnvPreset {
  name: string
  vars: EnvPresetVar[]
}

export const ENV_PRESETS: EnvPreset[] = [
  {
    name: 'Supabase',
    vars: [
      { key: 'SUPABASE_URL', category: 'Supabase' },
      { key: 'SUPABASE_ANON_KEY', category: 'Supabase' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', category: 'Supabase' },
    ],
  },
  {
    name: 'Firebase',
    vars: [
      { key: 'FIREBASE_API_KEY', category: 'Firebase' },
      { key: 'FIREBASE_AUTH_DOMAIN', category: 'Firebase' },
      { key: 'FIREBASE_PROJECT_ID', category: 'Firebase' },
      { key: 'FIREBASE_STORAGE_BUCKET', category: 'Firebase' },
      { key: 'FIREBASE_MESSAGING_SENDER_ID', category: 'Firebase' },
      { key: 'FIREBASE_APP_ID', category: 'Firebase' },
      { key: 'FIREBASE_DATABASE_URL', category: 'Firebase' },
    ],
  },
  {
    name: 'Database',
    vars: [
      { key: 'DATABASE_URL', category: 'Database URL' },
      { key: 'DATABASE_HOST', category: 'Database URL' },
      { key: 'DATABASE_PORT', category: 'Database URL' },
      { key: 'DATABASE_NAME', category: 'Database URL' },
      { key: 'DATABASE_USER', category: 'Database URL' },
      { key: 'DATABASE_PASSWORD', category: 'Database Password' },
    ],
  },
  {
    name: 'Razorpay',
    vars: [
      { key: 'RAZORPAY_KEY_ID', category: 'Payment Gateway' },
      { key: 'RAZORPAY_KEY_SECRET', category: 'Payment Gateway' },
    ],
  },
  {
    name: 'SMTP',
    vars: [
      { key: 'SMTP_HOST', category: 'Email' },
      { key: 'SMTP_PORT', category: 'Email' },
      { key: 'SMTP_USER', category: 'Email' },
      { key: 'SMTP_PASSWORD', category: 'Email' },
    ],
  },
  {
    name: 'Neon',
    vars: [{ key: 'NEON_DATABASE_URL', category: 'Neon' }],
  },
  {
    name: 'Hosting & Tokens',
    vars: [
      { key: 'VERCEL_TOKEN', category: 'Vercel' },
      { key: 'GITHUB_TOKEN', category: 'GitHub' },
      { key: 'JWT_SECRET', category: 'Authentication' },
      { key: 'WEBHOOK_SECRET', category: 'Webhook' },
      { key: 'API_KEY', category: 'API Key' },
      { key: 'API_SECRET', category: 'API Secret' },
    ],
  },
]

export function guessCategoryForKey(key: string): string {
  const k = key.toUpperCase()
  for (const preset of ENV_PRESETS) {
    const match = preset.vars.find((v) => v.key === k)
    if (match) return match.category
  }
  if (k.includes('SUPABASE')) return 'Supabase'
  if (k.includes('FIREBASE')) return 'Firebase'
  if (k.includes('NEON')) return 'Neon'
  if (k.includes('DATABASE') && k.includes('PASSWORD')) return 'Database Password'
  if (k.includes('DATABASE') || k.includes('DB_')) return 'Database URL'
  if (k.includes('RAZORPAY') || k.includes('STRIPE') || k.includes('PAYMENT')) return 'Payment Gateway'
  if (k.includes('SMTP') || k.includes('EMAIL') || k.includes('MAIL')) return 'Email'
  if (k.includes('VERCEL')) return 'Vercel'
  if (k.includes('GITHUB')) return 'GitHub'
  if (k.includes('JWT') || k.includes('AUTH') || k.includes('SECRET_KEY')) return 'Authentication'
  if (k.includes('WEBHOOK')) return 'Webhook'
  if (k.includes('TOKEN')) return 'Token'
  if (k.includes('SECRET')) return 'API Secret'
  if (k.includes('KEY')) return 'API Key'
  return 'Custom'
}
