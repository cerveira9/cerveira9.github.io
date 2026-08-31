let clientPromise = null

export function getRuntimeConfig() {
  const config = window.PROMPTDECK_CONFIG || {}
  return {
    supabaseUrl: String(config.supabaseUrl || '').trim(),
    supabasePublishableKey: String(config.supabasePublishableKey || '').trim(),
    allowedEmails: Array.isArray(config.allowedEmails) ? config.allowedEmails.map((email) => String(email).toLowerCase()) : []
  }
}

export function isSupabaseConfigured() {
  const config = getRuntimeConfig()
  return Boolean(config.supabaseUrl && config.supabasePublishableKey)
}

export async function getSupabase() {
  if (!isSupabaseConfigured()) return null
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({ createClient }) => {
      const config = getRuntimeConfig()
      return createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    })
  }
  return clientPromise
}

export function isEmailAllowed(email) {
  const list = getRuntimeConfig().allowedEmails
  return list.length === 0 || list.includes(String(email || '').toLowerCase())
}
