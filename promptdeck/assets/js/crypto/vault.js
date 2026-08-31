const encoder = new TextEncoder()
const decoder = new TextDecoder()
const DEFAULT_ITERATIONS = 310000

function bytesToBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function deriveKey(secret, salt, iterations = DEFAULT_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'PBKDF2' }, false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptVault(payload, secret) {
  if (!secret || secret.length < 10) throw new Error('O segredo do cofre precisa ter pelo menos 10 caracteres.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(secret, salt)
  const plaintext = encoder.encode(JSON.stringify(payload))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    cipher: 'AES-256-GCM',
    iterations: DEFAULT_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted))
  }
}

export async function decryptVault(envelope, secret) {
  if (!envelope || envelope.version !== 1) throw new Error('Formato de cofre não suportado.')
  const key = await deriveKey(secret, base64ToBytes(envelope.salt), envelope.iterations)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ciphertext)
  )
  const payload = JSON.parse(decoder.decode(decrypted))
  if (payload.version !== 1 || !Array.isArray(payload.prompts)) throw new Error('Conteúdo do cofre inválido.')
  return payload
}
