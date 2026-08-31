import { icon } from './icons.js'
import { initialValues, renderPrompt } from '../domain/template.js'

export function authView() {
  return `<main class="gate-screen"><section class="gate-card"><div class="brand-mark">${icon('shield',28)}</div><span class="eyebrow">PROMPTDECK</span><h1>Seu cofre de prompts.</h1><p>A interface fica no GitHub Pages. Seus prompts não ficam dentro do código do site.</p><button id="signInButton" class="primary wide">Entrar com Google</button><div class="security-note">${icon('shield')}<span>Autenticação + RLS + cofre cifrado no dispositivo.</span></div></section></main>`
}

export function deniedView(email) {
  return `<main class="gate-screen"><section class="gate-card"><div class="brand-mark">${icon('lock',28)}</div><span class="eyebrow">ACESSO NEGADO</span><h1>Conta não autorizada.</h1><p>${escapeHtml(email || 'Esta conta')} não está autorizada.</p><button id="signOutButton" class="secondary wide">Sair</button></section></main>`
}

export function vaultGateView({ localMode, error = '', busy = false }) {
  return `<main class="gate-screen"><form id="vaultForm" class="gate-card"><div class="brand-mark">${icon('lock',28)}</div><span class="eyebrow">VAULT</span><h1>Desbloquear cofre</h1><p>O segredo deriva localmente a chave AES-256-GCM e não é enviado ao banco.</p><label class="field"><span>Segredo do cofre</span><input id="vaultSecret" type="password" minlength="12" autocomplete="current-password" placeholder="12+ caracteres" required></label>${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ''}<button class="primary wide" ${busy ? 'disabled' : ''}>${busy ? 'Abrindo…' : 'Desbloquear'}</button>${localMode ? '<div class="dev-note">Modo local: apenas o envelope cifrado é salvo neste navegador.</div>' : ''}</form></main>`
}

export function appView({ prompts, query, filter = 'all', localMode, email }) {
  const filtered = filterPrompts(prompts, query, filter)
  const cards = filtered.map(promptCard).join('') || `<div class="empty-state">${icon('search',28)}<h3>Nada encontrado</h3><p>Tente outro termo.</p></div>`
  return `<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark small">PD</div><div><strong>PromptDeck</strong><small>Private Vault</small></div></div><nav><button class="nav ${filter === 'all' ? 'active' : ''}" data-library-filter="all">Biblioteca</button><button class="nav ${filter === 'favorites' ? 'active' : ''}" data-library-filter="favorites">Favoritos</button><button class="nav" disabled>Recentes <span class="soon">breve</span></button></nav><div class="sidebar-spacer"></div><button id="exportButton" class="nav">${icon('download')} Exportar cofre cifrado</button><button id="importButton" class="nav">${icon('upload')} Importar backup</button><input id="importFile" type="file" accept="application/json,.json" hidden><div class="security-chip">${icon('shield')}<span>Cofre desbloqueado<small>${localMode ? 'Local + AES-GCM' : 'Supabase + AES-GCM'}</small></span></div></aside><main class="content"><header class="topbar"><div><span class="eyebrow">${filter === 'favorites' ? 'FAVORITOS' : 'BIBLIOTECA'}</span><h1>${filter === 'favorites' ? 'Seus favoritos' : 'Seus prompts'}</h1>${email ? `<small class="account">${escapeHtml(email)}</small>` : ''}</div><div class="top-actions"><button id="newPromptButton" class="secondary desktop-only">${icon('plus')} Novo prompt</button><button id="lockButton" class="icon-btn" title="Bloquear">${icon('lock')}</button><button id="signOutButton" class="icon-btn" title="Sair">${icon('logout')}</button></div></header><section class="toolbar"><label class="search">${icon('search')}<input id="searchInput" placeholder="Buscar título, tag ou categoria…" value="${escapeAttr(query)}"></label><span class="count">${filtered.length} ${filtered.length === 1 ? 'prompt' : 'prompts'}</span></section><section class="prompt-grid">${cards}</section><button id="fabButton" class="fab" aria-label="Novo prompt">${icon('plus',22)}</button></main></div>`
}

function promptCard(prompt) {
  const configurable = (prompt.variables || []).length > 0
  return `<article class="prompt-card"><button class="card-main" data-action="${configurable ? 'configure' : 'copy'}" data-prompt-id="${escapeAttr(prompt.id)}"><div class="card-top"><span class="pill">${escapeHtml(prompt.category)}</span>${prompt.favorite ? icon('star',17) : ''}</div><h3>${escapeHtml(prompt.title)}</h3><p>${escapeHtml(prompt.description || 'Sem descrição')}</p><div class="tags">${(prompt.tags || []).slice(0,4).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div></button><div class="card-actions"><button class="icon-btn" data-action="favorite" data-prompt-id="${escapeAttr(prompt.id)}" title="Favorito">${icon('star')}</button><button class="icon-btn" data-action="edit" data-prompt-id="${escapeAttr(prompt.id)}" title="Editar">${icon('edit')}</button>${configurable ? `<button class="icon-btn" data-action="configure" data-prompt-id="${escapeAttr(prompt.id)}" title="Configurar">${icon('settings')}</button>` : ''}<button class="copy-btn" data-action="copy" data-prompt-id="${escapeAttr(prompt.id)}">${icon('copy')} Copiar</button></div></article>`
}

export function configureModal(prompt) {
  const values = initialValues(prompt)
  const fields = (prompt.variables || []).map(v => variableField(v, values[v.key])).join('')
  return modalShell('CONFIGURAR', prompt.title, `<div class="configure-grid"><div class="fields">${fields}</div><div class="preview"><span class="eyebrow">PREVIEW</span><pre id="promptPreview">${escapeHtml(renderPrompt(prompt,values))}</pre></div></div>`, `<button id="copyConfiguredButton" class="primary">${icon('copy')} Copiar prompt</button>`)
}

export function editorModal(prompt = null) {
  const editing = Boolean(prompt)
  const variables = (prompt?.variables || []).map(variableEditorCard).join('')
  return modalShell(editing ? 'EDITAR PROMPT' : 'NOVO PROMPT', editing ? prompt.title : 'Criar prompt', `<div class="editor-grid"><div class="editor-form"><label class="field"><span>Título</span><input id="promptTitle" value="${escapeAttr(prompt?.title || '')}"></label><label class="field"><span>Descrição</span><input id="promptDescription" value="${escapeAttr(prompt?.description || '')}"></label><div class="field-row"><label class="field"><span>Categoria</span><input id="promptCategory" value="${escapeAttr(prompt?.category || 'Geral')}"></label><label class="field"><span>Tags</span><input id="promptTags" value="${escapeAttr((prompt?.tags || []).join(', '))}" placeholder="imagem, foto, carro"></label></div><label class="field"><span>Template</span><textarea id="promptTemplate" placeholder="Use {{pose}} onde a variável deve entrar.">${escapeHtml(prompt?.template || '')}</textarea></label></div><div class="variable-panel"><div class="section-title"><div><span class="eyebrow">VARIÁVEIS</span><h3>Campos dinâmicos</h3></div><button id="addVariableButton" class="secondary">${icon('plus')} Adicionar</button></div><div id="variablesContainer">${variables || '<div class="empty-mini">Adicione variáveis para criar um prompt configurável.</div>'}</div></div></div>`, `<div class="danger-zone">${editing ? `<button id="deletePromptButton" class="danger">${icon('trash')} Excluir</button>` : ''}</div><button id="savePromptButton" class="primary">Salvar no cofre</button>`)
}

export function variableEditorCard(variable = {}) {
  const id = variable.id || crypto.randomUUID()
  const type = variable.type || 'text'
  const options = (variable.options || []).map(o => `${o.label} | ${o.value}`).join('\n')
  return `<div class="variable-card" data-variable-id="${escapeAttr(id)}"><div class="variable-head"><strong>Variável</strong><button class="icon-btn small-icon" data-action="remove-variable">${icon('trash',15)}</button></div><div class="field-row"><label class="field"><span>Rótulo</span><input data-var="label" value="${escapeAttr(variable.label || '')}" placeholder="Pose"></label><label class="field"><span>Chave</span><input data-var="key" value="${escapeAttr(variable.key || '')}" placeholder="pose"></label></div><label class="field"><span>Tipo</span><select data-var="type"><option value="text" ${type === 'text' ? 'selected' : ''}>Texto</option><option value="select" ${type === 'select' ? 'selected' : ''}>Lista</option><option value="toggle" ${type === 'toggle' ? 'selected' : ''}>Liga/desliga</option></select></label><label class="field options-field" ${type === 'select' ? '' : 'hidden'}><span>Opções — Nome | valor inserido</span><textarea data-var="options" rows="5">${escapeHtml(options)}</textarea></label><label class="field"><span>Valor padrão</span><input data-var="default" value="${escapeAttr(variable.defaultValue ?? '')}"></label><div class="hint">Use <code>{{${escapeHtml(variable.key || 'chave')}}}</code> no template.</div></div>`
}

function modalShell(eyebrow,title,body,footer) {
  return `<div id="modalBackdrop" class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal-header"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2></div><button id="closeModalButton" class="icon-btn">${icon('close')}</button></header><div class="modal-body">${body}</div><footer class="modal-footer">${footer}</footer></section></div>`
}

function variableField(variable,value) {
  if (variable.type === 'select') return `<label class="field"><span>${escapeHtml(variable.label)}</span><select data-variable-key="${escapeAttr(variable.key)}">${(variable.options || []).map(o => `<option value="${escapeAttr(o.value)}" ${o.value === value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`
  if (variable.type === 'toggle') return `<label class="toggle-field"><span>${escapeHtml(variable.label)}</span><input type="checkbox" data-variable-key="${escapeAttr(variable.key)}" ${value ? 'checked' : ''}></label>`
  return `<label class="field"><span>${escapeHtml(variable.label)}</span><input data-variable-key="${escapeAttr(variable.key)}" value="${escapeAttr(value || '')}"></label>`
}

function filterPrompts(prompts, query, filter) {
  const source = filter === 'favorites' ? prompts.filter(prompt => prompt.favorite) : prompts
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return source
  return source.filter(prompt => [prompt.title,prompt.description,prompt.category,...(prompt.tags || [])].join(' ').toLowerCase().includes(needle))
}

export function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]) }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g,'&#96;') }
