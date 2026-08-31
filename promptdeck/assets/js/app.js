import { encryptVault, decryptVault } from './crypto/vault.js'
import { exportEncryptedBackup, loadEncryptedVault, readEncryptedBackup, saveEncryptedVault } from './data/store.js'
import { getSupabase, isCurrentUserOwner, isSupabaseConfigured } from './data/supabase.js'
import { createPrompt, defaultValues, initialValues, normalizePrompt, promptSnapshot, renderPrompt, restoreSnapshot } from './domain/template.js'
import { appView, authView, configureModal, deniedView, editorModal, escapeHtml, textImportModal, variableEditorCard, versionsModal, vaultGateView } from './ui/render.js'

const root = document.querySelector('#app')
const toastElement = document.querySelector('#toast')
const AUTO_LOCK_MS = 15 * 60 * 1000
const MAX_HISTORY = 60
const MAX_VERSIONS = 20

const state = {
  session: null,
  user: null,
  secret: '',
  vaultId: null,
  envelope: null,
  prompts: [],
  copyHistory: [],
  query: '',
  filter: 'quick',
  localMode: !isSupabaseConfigured(),
  busy: false,
  ownerAccess: null,
  error: '',
  lastActivityAt: Date.now()
}

async function boot() {
  bindAutoLock()
  registerServiceWorker()
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
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) notify('Falha ao iniciar login Google')
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
    state.busy = true
    state.error = ''
    renderVaultGate()
    try {
      await openVault(secret)
      state.secret = secret
      state.busy = false
      state.lastActivityAt = Date.now()
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
  const stored = await loadEncryptedVault(state.user?.id)
  if (!stored) {
    const envelope = await encryptVault({ version: 1, prompts: [], copyHistory: [] }, secret)
    const created = await saveEncryptedVault({ userId: state.user?.id, envelope })
    state.vaultId = created.id
    state.envelope = envelope
    state.prompts = []
    state.copyHistory = []
    return
  }
  const payload = await decryptVault(stored.envelope, secret)
  state.vaultId = stored.id
  state.envelope = stored.envelope
  state.prompts = (payload.prompts || []).map(normalizePrompt)
  state.copyHistory = Array.isArray(payload.copyHistory) ? payload.copyHistory.slice(0, MAX_HISTORY) : []
}

async function persistVault() {
  const envelope = await encryptVault({ version: 1, prompts: state.prompts, copyHistory: state.copyHistory.slice(0, MAX_HISTORY) }, state.secret)
  const saved = await saveEncryptedVault({ userId: state.user?.id, vaultId: state.vaultId, envelope })
  state.vaultId = saved.id
  state.envelope = envelope
}

function renderApp() {
  root.innerHTML = appView({ prompts: state.prompts, copyHistory: state.copyHistory, query: state.query, filter: state.filter, localMode: state.localMode, email: state.user?.email })
  document.querySelector('#searchInput')?.addEventListener('input', (event) => {
    state.query = event.target.value
    renderApp()
    document.querySelector('#searchInput')?.focus()
  })
  document.querySelector('#newPromptButton')?.addEventListener('click', () => openEditor())
  document.querySelector('#fabButton')?.addEventListener('click', () => openEditor())
  document.querySelectorAll('[data-library-filter]').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.libraryFilter
    state.query = ''
    renderApp()
  }))
  document.querySelector('#lockButton').addEventListener('click', lockVault)
  document.querySelector('#signOutButton').addEventListener('click', signOut)
  document.querySelector('#exportButton').addEventListener('click', () => state.envelope && exportEncryptedBackup(state.envelope))
  document.querySelector('#importButton')?.addEventListener('click', () => document.querySelector('#importFile')?.click())
  document.querySelector('#importFile')?.addEventListener('change', importBackup)
  document.querySelector('#textImportButton')?.addEventListener('click', openTextImporter)
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', handleAction))
}

async function handleAction(event) {
  event.stopPropagation()
  const button = event.currentTarget
  const action = button.dataset.action
  if (action === 'copy-history') {
    const entry = state.copyHistory.find(item => item.id === button.dataset.historyId)
    if (entry) await copyText(entry.rendered, 'Copiado do histórico')
    return
  }
  const prompt = state.prompts.find(item => item.id === button.dataset.promptId)
  if (!prompt) return
  if (action === 'copy') return copyAndRemember(prompt, initialValues(prompt), prompt.variables?.length ? 'Copiado com última configuração' : 'Prompt copiado')
  if (action === 'configure') return openConfigure(prompt)
  if (action === 'edit') return openEditor(prompt)
  if (action === 'versions') return openVersions(prompt)
  if (action === 'favorite') {
    prompt.favorite = !prompt.favorite
    prompt.updatedAt = new Date().toISOString()
    await persistVault()
    renderApp()
    notify(prompt.favorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos')
  }
}

async function copyAndRemember(prompt, values, message) {
  const rendered = renderPrompt(prompt, values)
  await copyText(rendered, message)
  prompt.lastValues = structuredClone(values)
  prompt.lastUsedAt = new Date().toISOString()
  prompt.updatedAt = prompt.updatedAt || prompt.lastUsedAt
  state.copyHistory.unshift({ id: crypto.randomUUID(), promptId: prompt.id, title: prompt.title, rendered, createdAt: prompt.lastUsedAt })
  state.copyHistory = state.copyHistory.slice(0, MAX_HISTORY)
  try { await persistVault() } catch (error) { console.error(error); notify('Copiado; sincronização pendente') }
}

function openConfigure(prompt) {
  document.body.insertAdjacentHTML('beforeend', configureModal(prompt))
  const modal = document.querySelector('#modalBackdrop')
  const values = initialValues(prompt)
  bindModalClose(modal)
  const fields = [...modal.querySelectorAll('[data-variable-key]')]
  const preview = document.querySelector('#promptPreview')
  const presetSelect = document.querySelector('#presetSelect')
  const deletePresetButton = document.querySelector('#deletePresetButton')
  const refresh = () => { preview.textContent = renderPrompt(prompt, values) }
  const readFields = () => {
    fields.forEach(field => { values[field.dataset.variableKey] = field.type === 'checkbox' ? field.checked : field.value })
    refresh()
  }
  const writeFields = (nextValues) => {
    Object.assign(values, nextValues)
    fields.forEach(field => {
      const value = values[field.dataset.variableKey]
      if (field.type === 'checkbox') field.checked = Boolean(value)
      else field.value = value ?? ''
    })
    refresh()
  }
  fields.forEach(field => field.addEventListener('input', readFields))
  presetSelect.addEventListener('change', () => {
    const preset = (prompt.presets || []).find(item => item.id === presetSelect.value)
    deletePresetButton.disabled = !preset
    if (preset) writeFields({ ...defaultValues(prompt), ...preset.values })
  })
  document.querySelector('#resetValuesButton').addEventListener('click', () => {
    presetSelect.value = ''
    deletePresetButton.disabled = true
    writeFields(defaultValues(prompt))
  })
  document.querySelector('#savePresetButton').addEventListener('click', async () => {
    readFields()
    const name = window.prompt('Nome do preset:')?.trim()
    if (!name) return
    prompt.presets = [...(prompt.presets || []), { id: crypto.randomUUID(), name, values: structuredClone(values), createdAt: new Date().toISOString() }].slice(-30)
    await persistVault()
    closeModal()
    openConfigure(prompt)
    notify('Preset salvo')
  })
  deletePresetButton.addEventListener('click', async () => {
    if (!presetSelect.value) return
    prompt.presets = (prompt.presets || []).filter(item => item.id !== presetSelect.value)
    await persistVault()
    closeModal()
    openConfigure(prompt)
    notify('Preset removido')
  })
  document.querySelector('#copyConfiguredButton').addEventListener('click', async () => {
    readFields()
    await copyAndRemember(prompt, values, 'Prompt configurado e copiado')
  })
}

function openEditor(prompt = null) {
  document.body.insertAdjacentHTML('beforeend', editorModal(prompt))
  const modal = document.querySelector('#modalBackdrop')
  bindModalClose(modal)
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
    if (prompt) {
      const versions = [...(prompt.versions || []), promptSnapshot(prompt)].slice(-MAX_VERSIONS)
      const next = createPrompt({ ...data, versions, presets: prompt.presets, lastValues: prompt.lastValues, lastUsedAt: prompt.lastUsedAt })
      state.prompts = state.prompts.map(item => item.id === prompt.id ? next : item)
    } else {
      state.prompts = [createPrompt(data), ...state.prompts]
    }
    await persistVault()
    closeModal()
    renderApp()
    notify(prompt ? 'Prompt atualizado; versão anterior preservada' : 'Prompt salvo no cofre')
  })
  document.querySelector('#deletePromptButton')?.addEventListener('click', async () => {
    if (!confirm(`Excluir “${prompt.title}”?`)) return
    state.prompts = state.prompts.filter(item => item.id !== prompt.id)
    await persistVault()
    closeModal()
    renderApp()
    notify('Prompt excluído')
  })
}

function openVersions(prompt) {
  document.body.insertAdjacentHTML('beforeend', versionsModal(prompt))
  const modal = document.querySelector('#modalBackdrop')
  bindModalClose(modal)
  document.querySelector('#closeVersionsButton')?.addEventListener('click', closeModal)
  modal.querySelectorAll('[data-action="restore-version"]').forEach(button => button.addEventListener('click', async () => {
    const snapshot = (prompt.versions || []).find(item => item.id === button.dataset.versionId)
    if (!snapshot || !confirm('Restaurar esta versão? A versão atual também será preservada.')) return
    const versions = [...(prompt.versions || []), promptSnapshot(prompt)].slice(-MAX_VERSIONS)
    const restored = restoreSnapshot({ ...prompt, versions }, snapshot)
    restored.versions = versions
    state.prompts = state.prompts.map(item => item.id === prompt.id ? restored : item)
    await persistVault()
    closeModal()
    renderApp()
    notify('Versão restaurada')
  }))
}

function openTextImporter() {
  document.body.insertAdjacentHTML('beforeend', textImportModal())
  const modal = document.querySelector('#modalBackdrop')
  bindModalClose(modal)
  document.querySelector('#runImportButton').addEventListener('click', async () => {
    const text = document.querySelector('#importText').value.trim()
    const mode = document.querySelector('#importMode').value
    const category = document.querySelector('#importCategory').value.trim() || 'Importado'
    const tags = document.querySelector('#importTags').value.split(',').map(tag => tag.trim()).filter(Boolean)
    const title = document.querySelector('#importTitle').value.trim()
    if (!text) return notify('Cole algum texto para importar')
    const drafts = parseImportedText({ text, mode, title, category, tags })
    if (!drafts.length) return notify('Nenhum prompt identificado')
    if (!confirm(`Importar ${drafts.length} prompt(s) para o Vault?`)) return
    state.prompts = [...drafts.map(createPrompt), ...state.prompts]
    await persistVault()
    closeModal()
    state.filter = 'all'
    renderApp()
    notify(`${drafts.length} prompt(s) importado(s)`)
  })
}

function parseImportedText({ text, mode, title, category, tags }) {
  if (mode === 'single') return [{ title: title || 'Prompt importado', description: 'Importado de texto', category, tags, template: text, variables: [] }]
  if (mode === 'separator') return text.split(/^\s*-{3,}\s*$/m).map(part => part.trim()).filter(Boolean).map((part,index) => ({ title: firstLineTitle(part, `Prompt importado ${index + 1}`), description: 'Importado de texto', category, tags, template: part, variables: [] }))
  const lines = text.split(/\r?\n/)
  const groups = []
  let current = null
  for (const line of lines) {
    const match = line.match(/^#{1,2}\s+(.+)$/)
    if (match) {
      if (current && current.body.join('\n').trim()) groups.push(current)
      current = { title: match[1].trim(), body: [] }
    } else {
      if (!current) current = { title: '', body: [] }
      current.body.push(line)
    }
  }
  if (current && current.body.join('\n').trim()) groups.push(current)
  return groups.map((group,index) => ({ title: group.title || `Prompt importado ${index + 1}`, description: 'Importado de texto', category, tags, template: group.body.join('\n').trim(), variables: [] }))
}

function firstLineTitle(text, fallback) {
  const first = text.split(/\r?\n/).map(line => line.trim()).find(Boolean)
  return first && first.length <= 80 ? first.replace(/^#+\s*/, '') : fallback
}

function bindVariableCards() {
  document.querySelectorAll('.variable-card').forEach(card => {
    card.querySelector('[data-action="remove-variable"]')?.addEventListener('click', () => card.remove())
    card.querySelector('[data-var="type"]')?.addEventListener('change', (event) => { card.querySelector('.options-field').hidden = event.target.value !== 'select' })
    card.querySelector('[data-var="key"]')?.addEventListener('input', (event) => {
      event.target.value = event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      card.querySelector('.hint code').textContent = `{{${event.target.value || 'chave'}}}`
    })
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
    if (type === 'toggle') defaultValue = ['true','1','sim','yes'].includes(defaultValue.toLowerCase())
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
    const prompts = (payload.prompts || []).map(normalizePrompt)
    if (!confirm(`Restaurar backup com ${prompts.length} prompt(s) e substituir o Vault atual?`)) return
    const saved = await saveEncryptedVault({ userId: state.user?.id, vaultId: state.vaultId, envelope })
    state.vaultId = saved.id
    state.envelope = envelope
    state.prompts = prompts
    state.copyHistory = Array.isArray(payload.copyHistory) ? payload.copyHistory.slice(0, MAX_HISTORY) : []
    state.filter = 'quick'
    renderApp()
    notify('Backup restaurado com sucesso')
  } catch (error) {
    console.error(error)
    notify('Não foi possível restaurar o backup')
  }
}

function bindModalClose(modal) {
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal() })
  document.querySelector('#closeModalButton')?.addEventListener('click', closeModal)
}

function bindAutoLock() {
  const markActivity = () => { state.lastActivityAt = Date.now() }
  for (const eventName of ['pointerdown','keydown','touchstart','focus']) window.addEventListener(eventName, markActivity, { passive: true })
  setInterval(() => {
    if (state.secret && Date.now() - state.lastActivityAt >= AUTO_LOCK_MS) {
      lockVault()
      notify('Cofre bloqueado por inatividade')
    }
  }, 30_000)
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return
  navigator.serviceWorker.register('./sw.js').then(registration => registration.update()).catch(() => {})
}

function closeModal() { document.querySelector('#modalBackdrop')?.remove() }
function lockVault() {
  state.secret = ''
  state.prompts = []
  state.copyHistory = []
  state.vaultId = null
  state.envelope = null
  state.error = ''
  state.lastActivityAt = Date.now()
  renderVaultGate()
}
async function signOut() {
  lockVault()
  if (!state.localMode) {
    const supabase = await getSupabase()
    await supabase.auth.signOut()
  } else renderVaultGate()
}
function notify(message) {
  toastElement.textContent = message
  toastElement.hidden = false
  clearTimeout(notify.timer)
  notify.timer = setTimeout(() => { toastElement.hidden = true }, 1900)
}

boot().catch(error => {
  console.error(error)
  root.innerHTML = `<main class="gate-screen"><section class="gate-card"><h1>Erro ao iniciar</h1><p>${escapeHtml(error.message)}</p></section></main>`
})
