import { icon } from './icons.js'
import { defaultValues, initialValues, renderPrompt } from '../domain/template.js'

export function authView() {
  return `<main class="gate-screen"><section class="gate-card"><div class="brand-mark">${icon('shield',28)}</div><span class="eyebrow">PROMPTDECK</span><h1>Seu cofre de prompts.</h1><p>Entre com sua conta Google autorizada. O conteúdo do Vault é cifrado no dispositivo antes de ser sincronizado.</p><button id="signInButton" class="primary wide">Entrar com Google</button><div class="security-note">${icon('shield')}<span>Google OAuth + owner lock + RLS + AES-256-GCM.</span></div></section></main>`
}

export function deniedView(email) {
  return `<main class="gate-screen"><section class="gate-card"><div class="brand-mark">${icon('lock',28)}</div><span class="eyebrow">ACESSO NEGADO</span><h1>Conta não autorizada.</h1><p>${escapeHtml(email || 'Esta conta')} não é a identidade proprietária deste PromptDeck.</p><button id="signOutButton" class="secondary wide">Sair</button></section></main>`
}

export function vaultGateView({ localMode, error = '', busy = false }) {
  return `<main class="gate-screen"><form id="vaultForm" class="gate-card"><div class="brand-mark">${icon('lock',28)}</div><span class="eyebrow">VAULT</span><h1>Desbloquear cofre</h1><p>O segredo deriva localmente a chave do Vault e nunca é enviado ao Supabase.</p><label class="field"><span>Segredo do cofre</span><input id="vaultSecret" type="password" minlength="12" autocomplete="current-password" placeholder="Seu segredo do Vault" required></label>${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ''}<button class="primary wide" ${busy ? 'disabled' : ''}>${busy ? 'Abrindo…' : 'Desbloquear'}</button><div class="dev-note">Dica: você pode salvar este segredo no gerenciador de senhas do iPhone/Chrome/Windows e usar a biometria do próprio sistema para preenchê-lo.</div>${localMode ? '<div class="dev-note">Modo local: o envelope cifrado fica apenas neste navegador.</div>' : ''}</form></main>`
}

export function appView({ prompts, copyHistory, query, filter = 'quick', localMode, email }) {
  const visiblePrompts = filterPrompts(prompts, query, filter)
  const body = filter === 'history' ? historyGrid(copyHistory) : promptGrid(visiblePrompts)
  const headings = {
    quick: ['QUICK DECK','Acesso rápido'],
    all: ['BIBLIOTECA','Seus prompts'],
    favorites: ['FAVORITOS','Seus favoritos'],
    recent: ['RECENTES','Usados recentemente'],
    history: ['HISTÓRICO','Últimas cópias']
  }
  const [eyebrow,title] = headings[filter] || headings.all
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark small">PD</div><div><strong>PromptDeck</strong><small>Private Vault</small></div></div>
      ${navButtons(filter)}
      <div class="sidebar-spacer"></div>
      <button id="textImportButton" class="nav">${icon('file')} Importar texto</button>
      <button id="exportButton" class="nav">${icon('download')} Exportar backup cifrado</button>
      <button id="importButton" class="nav">${icon('upload')} Restaurar backup</button>
      <input id="importFile" type="file" accept="application/json,.json" hidden>
      <div class="security-chip">${icon('shield')}<span>Cofre desbloqueado<small>${localMode ? 'Local + AES-GCM' : 'Supabase + AES-GCM'}</small></span></div>
    </aside>
    <main class="content">
      <header class="topbar"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1>${email ? `<small class="account">${escapeHtml(email)}</small>` : ''}</div><div class="top-actions"><button id="newPromptButton" class="secondary desktop-only">${icon('plus')} Novo prompt</button><button id="lockButton" class="icon-btn" title="Bloquear">${icon('lock')}</button><button id="signOutButton" class="icon-btn" title="Sair">${icon('logout')}</button></div></header>
      ${filter === 'history' ? '' : `<section class="toolbar"><label class="search">${icon('search')}<input id="searchInput" placeholder="Buscar título, tag ou categoria…" value="${escapeAttr(query)}"></label><span class="count">${visiblePrompts.length} ${visiblePrompts.length === 1 ? 'prompt' : 'prompts'}</span></section>`}
      ${filter === 'quick' ? quickDeckIntro(prompts) : ''}
      ${body}
      <button id="fabButton" class="fab" aria-label="Novo prompt">${icon('plus',22)}</button>
      ${mobileNav(filter)}
    </main>
  </div>`
}

function navButtons(filter) {
  return `<nav>
    <button class="nav ${filter === 'quick' ? 'active' : ''}" data-library-filter="quick">${icon('home')} Quick Deck</button>
    <button class="nav ${filter === 'all' ? 'active' : ''}" data-library-filter="all">${icon('layers')} Biblioteca</button>
    <button class="nav ${filter === 'favorites' ? 'active' : ''}" data-library-filter="favorites">${icon('star')} Favoritos</button>
    <button class="nav ${filter === 'recent' ? 'active' : ''}" data-library-filter="recent">${icon('clock')} Recentes</button>
    <button class="nav ${filter === 'history' ? 'active' : ''}" data-library-filter="history">${icon('history')} Histórico</button>
  </nav>`
}

function mobileNav(filter) {
  const items = [['quick','home','Deck'],['all','layers','Biblioteca'],['favorites','star','Favoritos'],['recent','clock','Recentes']]
  return `<nav class="mobile-nav">${items.map(([key,name,label]) => `<button class="${filter === key ? 'active' : ''}" data-library-filter="${key}">${icon(name,20)}<span>${label}</span></button>`).join('')}<button class="${filter === 'history' ? 'active' : ''}" data-library-filter="history">${icon('history',20)}<span>Histórico</span></button></nav>`
}

function quickDeckIntro(prompts) {
  const favorites = prompts.filter(p => p.favorite).length
  const recent = prompts.filter(p => p.lastUsedAt).length
  return `<section class="quick-stats"><div><strong>${favorites}</strong><span>favoritos</span></div><div><strong>${recent}</strong><span>já utilizados</span></div><div><strong>${prompts.length}</strong><span>no cofre</span></div></section>`
}

function promptGrid(prompts) {
  const cards = prompts.map(promptCard).join('') || `<div class="empty-state">${icon('search',28)}<h3>Nada aqui ainda</h3><p>Crie, favorite ou utilize prompts para preencher esta área.</p></div>`
  return `<section class="prompt-grid">${cards}</section>`
}

function historyGrid(history) {
  const items = (history || []).slice(0,60)
  if (!items.length) return `<section class="prompt-grid"><div class="empty-state">${icon('history',28)}<h3>Nenhuma cópia registrada</h3><p>O histórico é armazenado dentro do Vault cifrado.</p></div></section>`
  return `<section class="history-list">${items.map(entry => `<article class="history-row"><div><strong>${escapeHtml(entry.title || 'Prompt')}</strong><small>${formatDate(entry.createdAt)}</small></div><button class="copy-btn" data-action="copy-history" data-history-id="${escapeAttr(entry.id)}">${icon('copy')} Copiar novamente</button></article>`).join('')}</section>`
}

function promptCard(prompt) {
  const configurable = (prompt.variables || []).length > 0
  const presetCount = (prompt.presets || []).length
  const versionCount = (prompt.versions || []).length
  return `<article class="prompt-card"><button class="card-main" data-action="${configurable ? 'configure' : 'copy'}" data-prompt-id="${escapeAttr(prompt.id)}"><div class="card-top"><span class="pill">${escapeHtml(prompt.category)}</span>${prompt.favorite ? icon('star',17) : ''}</div><h3>${escapeHtml(prompt.title)}</h3><p>${escapeHtml(prompt.description || 'Sem descrição')}</p><div class="tags">${(prompt.tags || []).slice(0,4).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div><div class="card-meta">${prompt.lastUsedAt ? `<span>${icon('clock',13)} ${relativeDate(prompt.lastUsedAt)}</span>` : ''}${presetCount ? `<span>${presetCount} preset${presetCount === 1 ? '' : 's'}</span>` : ''}${versionCount ? `<span>${versionCount} versão${versionCount === 1 ? '' : 'ões'}</span>` : ''}</div></button><div class="card-actions"><button class="icon-btn" data-action="favorite" data-prompt-id="${escapeAttr(prompt.id)}" title="Favorito">${icon('star')}</button>${versionCount ? `<button class="icon-btn" data-action="versions" data-prompt-id="${escapeAttr(prompt.id)}" title="Versões">${icon('history')}</button>` : ''}<button class="icon-btn" data-action="edit" data-prompt-id="${escapeAttr(prompt.id)}" title="Editar">${icon('edit')}</button>${configurable ? `<button class="icon-btn" data-action="configure" data-prompt-id="${escapeAttr(prompt.id)}" title="Configurar">${icon('settings')}</button>` : ''}<button class="copy-btn" data-action="copy" data-prompt-id="${escapeAttr(prompt.id)}">${icon('copy')} Copiar</button></div></article>`
}

export function configureModal(prompt) {
  const values = initialValues(prompt)
  const fields = (prompt.variables || []).map(v => variableField(v, values[v.key])).join('')
  const presetOptions = (prompt.presets || []).map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join('')
  return modalShell('CONFIGURAR', prompt.title, `<div class="preset-toolbar"><label class="field compact"><span>Preset</span><select id="presetSelect"><option value="">Última configuração</option>${presetOptions}</select></label><button id="savePresetButton" class="secondary">${icon('save')} Salvar preset</button><button id="deletePresetButton" class="secondary" disabled>${icon('trash')} Excluir preset</button><button id="resetValuesButton" class="secondary">${icon('refresh')} Padrões</button></div><div class="configure-grid"><div class="fields">${fields}</div><div class="preview"><span class="eyebrow">PREVIEW</span><pre id="promptPreview">${escapeHtml(renderPrompt(prompt,values))}</pre></div></div>`, `<button id="copyConfiguredButton" class="primary">${icon('copy')} Copiar e lembrar</button>`)
}

export function editorModal(prompt = null) {
  const editing = Boolean(prompt)
  const variables = (prompt?.variables || []).map(variableEditorCard).join('')
  return modalShell(editing ? 'EDITAR PROMPT' : 'NOVO PROMPT', editing ? prompt.title : 'Criar prompt', `<div class="editor-grid"><div class="editor-form"><label class="field"><span>Título</span><input id="promptTitle" value="${escapeAttr(prompt?.title || '')}"></label><label class="field"><span>Descrição</span><input id="promptDescription" value="${escapeAttr(prompt?.description || '')}"></label><div class="field-row"><label class="field"><span>Categoria</span><input id="promptCategory" value="${escapeAttr(prompt?.category || 'Geral')}"></label><label class="field"><span>Tags</span><input id="promptTags" value="${escapeAttr((prompt?.tags || []).join(', '))}" placeholder="imagem, foto, carro"></label></div><label class="field"><span>Template</span><textarea id="promptTemplate" placeholder="Use {{pose}} onde a variável deve entrar.">${escapeHtml(prompt?.template || '')}</textarea></label>${editing ? `<div class="editor-info">${icon('history')} Ao salvar uma edição, a versão anterior é preservada automaticamente (até 20 versões).</div>` : ''}</div><div class="variable-panel"><div class="section-title"><div><span class="eyebrow">VARIÁVEIS</span><h3>Campos dinâmicos</h3></div><button id="addVariableButton" class="secondary">${icon('plus')} Adicionar</button></div><div id="variablesContainer">${variables || '<div class="empty-mini">Adicione variáveis para criar um prompt configurável.</div>'}</div></div></div>`, `<div class="danger-zone">${editing ? `<button id="deletePromptButton" class="danger">${icon('trash')} Excluir</button>` : ''}</div><button id="savePromptButton" class="primary">Salvar no cofre</button>`)
}

export function versionsModal(prompt) {
  const versions = (prompt.versions || []).slice().reverse()
  const rows = versions.map(version => `<article class="version-row"><div><strong>${formatDate(version.capturedAt)}</strong><small>${escapeHtml(version.title || '')}</small></div><button class="secondary" data-action="restore-version" data-version-id="${escapeAttr(version.id)}">${icon('history')} Restaurar</button></article>`).join('')
  return modalShell('VERSÕES', prompt.title, rows ? `<div class="version-list">${rows}</div>` : '<div class="empty-mini">Nenhuma versão anterior.</div>', `<button id="closeVersionsButton" class="secondary">Fechar</button>`)
}

export function textImportModal() {
  return modalShell('IMPORTAR', 'Migrar texto do Google Docs', `<div class="import-grid"><div class="editor-form"><label class="field"><span>Como separar</span><select id="importMode"><option value="single">Todo o texto = 1 prompt</option><option value="separator">Separar por linha ---</option><option value="headings">Separar por títulos # / ##</option></select></label><label class="field"><span>Título (modo 1 prompt)</span><input id="importTitle" placeholder="Nome do prompt"></label><div class="field-row"><label class="field"><span>Categoria</span><input id="importCategory" value="Importado"></label><label class="field"><span>Tags</span><input id="importTags" placeholder="google-docs, antigo"></label></div><label class="field"><span>Cole o conteúdo</span><textarea id="importText" class="import-text" placeholder="Cole aqui os prompts do Google Docs…"></textarea></label></div><aside class="import-help"><h3>Formatos seguros</h3><p><strong>1 prompt:</strong> preserva todo o texto.</p><p><strong>---</strong>: use uma linha com três hífens entre prompts.</p><p><strong># Título</strong>: cada heading inicia um prompt novo.</p><p>Nada é enviado em plaintext ao banco; a importação entra no Vault e é cifrada no próximo salvamento.</p></aside></div>`, `<button id="runImportButton" class="primary">${icon('upload')} Importar para o cofre</button>`)
}

export function variableEditorCard(variable = {}) {
  const id = variable.id || crypto.randomUUID()
  const type = variable.type || 'text'
  const options = (variable.options || []).map(o => `${o.label} | ${o.value}`).join('\n')
  return `<div class="variable-card" data-variable-id="${escapeAttr(id)}"><div class="variable-head"><strong>Variável</strong><button class="icon-btn small-icon" data-action="remove-variable">${icon('trash',15)}</button></div><div class="field-row"><label class="field"><span>Rótulo</span><input data-var="label" value="${escapeAttr(variable.label || '')}" placeholder="Pose"></label><label class="field"><span>Chave</span><input data-var="key" value="${escapeAttr(variable.key || '')}" placeholder="pose"></label></div><label class="field"><span>Tipo</span><select data-var="type"><option value="text" ${type === 'text' ? 'selected' : ''}>Texto</option><option value="select" ${type === 'select' ? 'selected' : ''}>Lista</option><option value="toggle" ${type === 'toggle' ? 'selected' : ''}>Liga/desliga</option></select></label><label class="field options-field" ${type === 'select' ? '' : 'hidden'}><span>Opções — Nome | valor inserido</span><textarea data-var="options" rows="5">${escapeHtml(options)}</textarea></label><label class="field"><span>Valor padrão</span><input data-var="default" value="${escapeAttr(variable.defaultValue ?? '')}"></label><div class="hint">Use <code>{{${escapeHtml(variable.key || 'chave')}}}</code> no template.</div></div>`
}

function variableField(variable,value) {
  if (variable.type === 'select') return `<label class="field"><span>${escapeHtml(variable.label)}</span><select data-variable-key="${escapeAttr(variable.key)}">${(variable.options || []).map(o => `<option value="${escapeAttr(o.value)}" ${o.value === value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`
  if (variable.type === 'toggle') return `<label class="toggle-field"><span>${escapeHtml(variable.label)}</span><input type="checkbox" data-variable-key="${escapeAttr(variable.key)}" ${value ? 'checked' : ''}></label>`
  return `<label class="field"><span>${escapeHtml(variable.label)}</span><input data-variable-key="${escapeAttr(variable.key)}" value="${escapeAttr(value || '')}"></label>`
}

function filterPrompts(prompts, query, filter) {
  let source = [...prompts]
  if (filter === 'favorites') source = source.filter(prompt => prompt.favorite)
  if (filter === 'recent') source = source.filter(prompt => prompt.lastUsedAt).sort((a,b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt))
  if (filter === 'quick') {
    const ranked = source.filter(p => p.favorite || p.lastUsedAt).sort((a,b) => {
      const fav = Number(b.favorite) - Number(a.favorite)
      if (fav) return fav
      return new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0)
    })
    source = ranked.slice(0,12)
  }
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return source
  return source.filter(prompt => [prompt.title,prompt.description,prompt.category,...(prompt.tags || [])].join(' ').toLowerCase().includes(needle))
}

function modalShell(eyebrow,title,body,footer) {
  return `<div id="modalBackdrop" class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal-header"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2></div><button id="closeModalButton" class="icon-btn">${icon('close')}</button></header><div class="modal-body">${body}</div><footer class="modal-footer">${footer}</footer></section></div>`
}

function relativeDate(value) {
  if (!value) return ''
  const diff = Math.max(0, Date.now() - new Date(value).getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} d`
}

function formatDate(value) {
  try { return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) } catch { return '' }
}

export function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]) }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g,'&#96;') }
