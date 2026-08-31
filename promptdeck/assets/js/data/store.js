import { getSupabase, isSupabaseConfigured } from './supabase.js'

const LOCAL_STORAGE_KEY = 'promptdeck.local.encrypted-vault'
let loadedRevision = 0

export async function loadEncryptedVault(userId) {
  if (!isSupabaseConfigured()) {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    const stored = raw ? JSON.parse(raw) : null
    loadedRevision = Number(stored?.revision || 0)
    return stored
  }
  const supabase = await getSupabase()
  const { data, error } = await supabase.from('vaults').select('id,envelope,revision').eq('user_id', userId).maybeSingle()
  if (error) throw error
  loadedRevision = Number(data?.revision || 0)
  return data ? { id: data.id, envelope: data.envelope, revision: loadedRevision } : null
}

export async function saveEncryptedVault({ userId, vaultId, envelope }) {
  if (!isSupabaseConfigured()) {
    loadedRevision += 1
    const stored = { id: vaultId || 'local', envelope, revision: loadedRevision }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stored))
    return stored
  }
  const supabase = await getSupabase()
  if (!vaultId) {
    const { data, error } = await supabase.from('vaults').insert({ user_id: userId, envelope, revision: 0, updated_at: new Date().toISOString() }).select('id,envelope,revision').single()
    if (error) throw error
    loadedRevision = Number(data.revision || 0)
    return { id: data.id, envelope: data.envelope, revision: loadedRevision }
  }
  const nextRevision = loadedRevision + 1
  const { data, error } = await supabase.from('vaults')
    .update({ envelope, revision: nextRevision, updated_at: new Date().toISOString() })
    .eq('id', vaultId)
    .eq('user_id', userId)
    .eq('revision', loadedRevision)
    .select('id,envelope,revision')
    .maybeSingle()
  if (error) throw error
  if (!data) {
    window.alert('O PromptDeck foi alterado em outro dispositivo. A página será recarregada para evitar sobrescrever essas mudanças.')
    window.location.reload()
    const conflict = new Error('Vault revision conflict')
    conflict.code = 'VAULT_CONFLICT'
    throw conflict
  }
  loadedRevision = Number(data.revision || nextRevision)
  return { id: data.id, envelope: data.envelope, revision: loadedRevision }
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
