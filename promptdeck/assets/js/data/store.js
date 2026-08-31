import { getSupabase, isSupabaseConfigured } from './supabase.js'

const LOCAL_STORAGE_KEY = 'promptdeck.local.encrypted-vault'

export async function loadEncryptedVault(userId) {
  if (!isSupabaseConfigured()) {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  }
  const supabase = await getSupabase()
  const { data, error } = await supabase.from('vaults').select('id,envelope').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data ? { id: data.id, envelope: data.envelope } : null
}

export async function saveEncryptedVault({ userId, vaultId, envelope }) {
  if (!isSupabaseConfigured()) {
    const stored = { id: vaultId || 'local', envelope }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stored))
    return stored
  }
  const supabase = await getSupabase()
  const payload = { user_id: userId, envelope, updated_at: new Date().toISOString() }
  const query = vaultId
    ? supabase.from('vaults').update(payload).eq('id', vaultId).eq('user_id', userId).select('id,envelope').single()
    : supabase.from('vaults').insert(payload).select('id,envelope').single()
  const { data, error } = await query
  if (error) throw error
  return { id: data.id, envelope: data.envelope }
}

export function exportEncryptedBackup(envelope) {
  const payload = { product: 'PromptDeck', formatVersion: 1, exportedAt: new Date().toISOString(), envelope }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `promptdeck-backup-${new Date().toISOString().slice(0, 10)}.pdvault.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function readEncryptedBackup(file) {
  const text = await file.text()
  const payload = JSON.parse(text)
  if (payload?.product !== 'PromptDeck' || payload?.formatVersion !== 1 || !payload?.envelope) throw new Error('Arquivo de backup do PromptDeck inválido.')
  const envelope = payload.envelope
  if (envelope.version !== 1 || envelope.cipher !== 'AES-256-GCM' || !envelope.ciphertext || !envelope.salt || !envelope.iv) throw new Error('Envelope cifrado inválido ou incompatível.')
  return envelope
}
