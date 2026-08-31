import { encryptVault, decryptVault } from './crypto/vault.js'
import { createDemoPrompts } from './data/demo.js'
import { exportEncryptedBackup, loadEncryptedVault, readEncryptedBackup, saveEncryptedVault } from './data/store.js'
import { getSupabase, isCurrentUserOwner, isSupabaseConfigured } from './data/supabase.js'
import { createPrompt, initialValues, renderPrompt } from './domain/template.js'
import { appView, authView, configureModal, deniedView, editorModal, escapeHtml, variableEditorCard, vaultGateView } from './ui/render.js'

const root = document.querySelector('#app')
const toastElement = document.querySelector('#toast')

const state = {
  session: null,
  user: null,
  secret: '',
  vaultId: null,
  envelope: null,
  prompts: [],
  query: '',
  filter: 'all',
  activePromptId: null,
  localMode: !isSupabaseConfigured(),
  busy: false,
  ownerAccess: null,
  error: '',
  lastActivityAt: Date.now()
}

const AUTO_LOCK_MS = 15 * 60 * 1000

async function boot() {
  bindAutoLock()
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {})
  if (state.localMode) return renderVaultGate()
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  state.session = data.session
  state.user = data.session?.user || null
  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session
    state.user = session?.user || null
    state.ownerAccess = null
    queueMicrotask(() => { void route() })
  })
  await route()
}

async function route() {
  if (!state.localMode && !state.user) return renderAuth()
  if (!state.localMode) {
    try {
      if (state.ownerAccess === null) state.ownerAccess = await isCurrentUserOwner()
      if (!state.ownerAccess) return renderDenied()
    } catch (error) {
      console.error(error)
      root.innerHTML = '<main class="gate-screen"><section class="gate-card"><h1>Falha ao validar acesso</h1><p>Não foi possível confirmar a identidade proprietária. Tente novamente.</p></section></main>'
      return
    }
  }
  if (!state.secret) return renderVaultGate()
  renderApp()
}

function renderAuth() {
  root.innerHTML = authView()
  document.querySelector('#signInButton').addEventListener('click', async () => {
    const supabase = await getSupabase()
    const redirectTo = new URL('.', window.location.href).href
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  })
}

function renderDenied() {
  root.innerHTML = deniedView(state.user?.email)
  document.querySelector('#signOutButton').addEventListener('click', signOut)
}

function renderVaultGate() {
  root.innerHTML = vaultGateView({ localMode: state.localMode, error: state.error, busy: state.busy })
  document.querySelector('#vaultForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const secret = document.querySelector('#vaultSecret').value
    state.busy = true; state.error = ''; renderVaultGate()
    try {
      await openVault(secret)
      state.secret = secret
      state.busy = false
      renderApp()
    } catch (error) {
      console.error(error)
      state.busy = false
      state.error = 'Não foi possível abrir o cofre. Confira o segredo informado.'
      renderVaultGate()
    }
  })
}

async function openVault(secret) {
  const userId = state.user?.id
  const stored = await loadEncryptedVault(userId)
  if (!stored) {
    const prompts = createDemoPrompts()
    const envelope = await encryptVault({ version: 1, prompts }, secret)
    const created = await saveEncryptedVault({ userId, envelope })
    state.vaultId = created.id; state.envelope = envelope; state.prompts = prompts
    return
  }
  const payload = await decryptVault(stored.envelope, secret)
  state.vaultId = stored.id; state.envelope = stored.envelope; state.prompts = payload.prompts
}

async function persistPrompts() {
  const envelope = await encryptVault({ version: 1, prompts: state.prompts }, state.secret)
  const saved = await saveEncryptedVault({ userId: state.user?.id, vaultId: state.vaultId, envelope })
  state.vaultId = saved.id; state.envelope = envelope
}

function renderApp() {
  root.innerHTML = appView({ prompts: state.prompts, query: state.query, filter: state.filter, localMode: state.localMode, email: state.user?.email })
  document.querySelector('#searchInput').addEventListener('input', (event) => { state.query = event.target.value; renderApp(); document.querySelector('#searchInput')?.focus() })
  document.querySelector('#newPromptButton')?.addEventListener('click', () => openEditor())
  document.querySelectorAll('[data-library-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.libraryFilter; renderApp() }))
  document.querySelector('#fabButton')?.addEventListener('click', () => openEditor())
  document.querySelector('#lockButton').addEventListener('click', lockVault)
  document.querySelector('#signOutButton').addEventListener('click', signOut)
  document.querySelector('#exportButton').addEventListener('click', () => state.envelope && exportEncryptedBackup(state.envelope))
  document.querySelector('#importButton')?.addEventListener('click', () => document.querySelector('#importFile')?.click())
  document.querySelector('#importFile')?.addEventListener('change', importBackup)
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', handleCardAction))
}

async function handleCardAction(event) {
  event.stopPropagation()
  const button = event.currentTarget
  const prompt = state.prompts.find(item => item.id === button.dataset.promptId)
  if (!prompt) return
  const action = button.dataset.action
  if (action === 'copy') return copyText(renderPrompt(prompt, initialValues(prompt)), prompt.variables?.length ? 'Copiado com valores padrão' : 'Prompt copiado')
  if (action === 'configure') return openConfigure(prompt)
  if (action === 'edit') return openEditor(prompt)
  if (action === 'favorite') {
    prompt.favorite = !prompt.favorite; prompt.updatedAt = new Date().toISOString(); await persistPrompts(); renderApp(); notify(prompt.favorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos')
  }
}

function openConfigure(prompt) {
  state.activePromptId = prompt.id
  document.body.insertAdjacentHTML('beforeend', configureModal(prompt))
  const modal = document.querySelector('#modalBackdrop')
  const values = initialValues(prompt)
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal() })
  document.querySelector('#closeModalButton').addEventListener('click', closeModal)
  modal.querySelectorAll('[data-variable-key]').forEach(field => field.addEventListener('input', () => {
    const key = field.dataset.variableKey
    values[key] = field.type === 'checkbox' ? field.checked : field.value
    document.querySelector('#promptPreview').textContent = renderPrompt(prompt, values)
  }))
  document.querySelector('#copyConfiguredButton').addEventListener('click', () => copyText(renderPrompt(prompt, values), 'Prompt configurado e copiado'))
}

function openEditor(prompt = null) {
  document.body.insertAdjacentHTML('beforeend', editorModal(prompt))
  const modal = document.querySelector('#modalBackdrop')
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal() })
  document.querySelector('#closeModalButton').addEventListener('click', closeModal)
  document.querySelector('#addVariableButton').addEventListener('click', () => {
    const container = document.querySelector('#variablesContainer')
    container.querySelector('.empty-mini')?.remove()
    container.insertAdjacentHTML('beforeend', variableEditorCard({ id: crypto.randomUUID(), type: 'text', key: `variavel_${container.querySelectorAll('.variable-card').length + 1}`, label: '', defaultValue: '' }))
    bindVariableCards()
  })
  bindVariableCards()
  document.querySelector('#savePromptButton').addEventListener('click', async () => {
    const data = collectEditorData(prompt)
    if (!data.title || !data.template) return notify('Título e template são obrigatórios')
    const next = createPrompt(data)
    if (prompt) state.prompts = state.prompts.map(item => item.id === prompt.id ? next : item)
    else state.prompts = [next, ...state.prompts]
    await persistPrompts(); closeModal(); renderApp(); notify(prompt ? 'Prompt atualizado' : 'Prompt salvo no cofre')
  })
  document.querySelector('#deletePromptButton')?.addEventListener('click', async () => {
    if (!confirm(`Excluir “${prompt.title}”?`)) return
    state.prompts = state.prompts.filter(item => item.id !== prompt.id)
    await persistPrompts(); closeModal(); renderApp(); notify('Prompt excluído')
  })
}

function bindVariableCards() {
  document.querySelectorAll('.variable-card').forEach(card => {
    card.querySelector('[data-action="remove-variable"]')?.addEventListener('click', () => card.remove())
    card.querySelector('[data-var="type"]')?.addEventListener('change', (event) => { card.querySelector('.options-field').hidden = event.target.value !== 'select' })
    card.querySelector('[data-var="key"]')?.addEventListener('input', (event) => { event.target.value = event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'); card.querySelector('.hint code').textContent = `{{${event.target.value || 'chave'}}}` })
  })
}

function collectEditorData(existing) {
  const variables = [...document.querySelectorAll('.variable-card')].map(card => {
    const type = card.querySelector('[data-var="type"]').value
    const options = type === 'select' ? card.querySelector('[data-var="options"]').value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const [label, ...valueParts] = line.split('|')
      const value = valueParts.join('|').trim() || label.trim()
      return { label: label.trim(), value }
    }) : []
    let defaultValue = card.querySelector('[data-var="default"]').value
    if (type === 'toggle') defaultValue = ['true', '1', 'sim', 'yes'].includes(defaultValue.toLowerCase())
    return { id: card.dataset.variableId, label: card.querySelector('[data-var="label"]').value.trim(), key: card.querySelector('[data-var="key"]').value.trim(), type, defaultValue, options }
  }).filter(variable => variable.label && variable.key)
  return {
    id: existing?.id,
    createdAt: existing?.createdAt,
    favorite: existing?.favorite,
    title: document.querySelector('#promptTitle').value,
    description: document.querySelector('#promptDescription').value,
    category: document.querySelector('#promptCategory').value,
    tags: document.querySelector('#promptTags').value.split(',').map(tag => tag.trim()).filter(Boolean),
    template: document.querySelector('#promptTemplate').value,
    variables
  }
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('Clipboard indisponível')
  }
  notify(message)
}

async function importBackup(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const envelope = await readEncryptedBackup(file)
    const payload = await decryptVault(envelope, state.secret)
    if (!confirm(`Importar backup com ${payload.prompts.length} prompt(s) e substituir o cofre atual?`)) return
    const saved = await saveEncryptedVault({ userId: state.user?.id, vaultId: state.vaultId, envelope })
    state.vaultId = saved.id
    state.envelope = envelope
    state.prompts = payload.prompts
    renderApp()
    notify('Backup importado com sucesso')
  } catch (error) {
    console.error(error)
    notify('Não foi possível importar o backup')
  }
}

function bindAutoLock() {
  const markActivity = () => { state.lastActivityAt = Date.now() }
  for (const eventName of ['pointerdown', 'keydown', 'touchstart', 'focus']) window.addEventListener(eventName, markActivity, { passive: true })
  setInterval(() => {
    if (state.secret && Date.now() - state.lastActivityAt >= AUTO_LOCK_MS) {
      lockVault()
      notify('Cofre bloqueado por inatividade')
    }
  }, 30_000)
}

function closeModal() { document.querySelector('#modalBackdrop')?.remove(); state.activePromptId = null }
function lockVault() { state.secret = ''; state.prompts = []; state.vaultId = null; state.envelope = null; state.error = ''; state.lastActivityAt = Date.now(); renderVaultGate() }
async function signOut() {
  state.ownerAccess = null
  lockVault()
  if (!state.localMode) {
    const supabase = await getSupabase()
    await supabase.auth.signOut()
  } else renderVaultGate()
}
function notify(message) { toastElement.textContent = message; toastElement.hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => { toastElement.hidden = true }, 1800) }

boot().catch(error => { console.error(error); root.innerHTML = `<main class="gate-screen"><section class="gate-card"><h1>Erro ao iniciar</h1><p>${escapeHtml(error.message)}</p></section></main>` })
