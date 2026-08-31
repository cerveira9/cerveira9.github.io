export function defaultValues(prompt) {
  return Object.fromEntries((prompt.variables || []).map((variable) => [variable.key, variable.defaultValue]))
}

export function initialValues(prompt) {
  return { ...defaultValues(prompt), ...(prompt.lastValues || {}) }
}

export function renderPrompt(prompt, values = {}) {
  let output = String(prompt.template || '')
  for (const variable of prompt.variables || []) {
    const raw = values[variable.key]
    let value = ''
    if (Array.isArray(raw)) value = raw.join(', ')
    else if (typeof raw === 'boolean') value = raw ? String(variable.trueValue || 'true') : String(variable.falseValue || '')
    else value = raw == null ? '' : String(raw)
    output = output.split(`{{${variable.key}}}`).join(value)
  }
  return output.replace(/\n{3,}/g, '\n\n').trim()
}

export function normalizePrompt(prompt) {
  return {
    ...prompt,
    tags: Array.isArray(prompt?.tags) ? prompt.tags : [],
    variables: Array.isArray(prompt?.variables) ? prompt.variables : [],
    presets: Array.isArray(prompt?.presets) ? prompt.presets : [],
    versions: Array.isArray(prompt?.versions) ? prompt.versions : [],
    lastValues: prompt?.lastValues && typeof prompt.lastValues === 'object' ? prompt.lastValues : {},
    lastUsedAt: prompt?.lastUsedAt || null
  }
}

export function createPrompt(data) {
  const now = new Date().toISOString()
  return normalizePrompt({
    id: data.id || crypto.randomUUID(),
    title: String(data.title || '').trim(),
    description: String(data.description || '').trim(),
    category: String(data.category || 'Geral').trim() || 'Geral',
    tags: Array.isArray(data.tags) ? data.tags : [],
    favorite: Boolean(data.favorite),
    template: String(data.template || ''),
    variables: Array.isArray(data.variables) ? data.variables : [],
    presets: data.presets || [],
    versions: data.versions || [],
    lastValues: data.lastValues || {},
    lastUsedAt: data.lastUsedAt || null,
    createdAt: data.createdAt || now,
    updatedAt: now
  })
}

export function promptSnapshot(prompt) {
  return {
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    title: prompt.title,
    description: prompt.description,
    category: prompt.category,
    tags: structuredClone(prompt.tags || []),
    template: prompt.template,
    variables: structuredClone(prompt.variables || [])
  }
}

export function restoreSnapshot(prompt, snapshot) {
  return createPrompt({
    ...prompt,
    title: snapshot.title,
    description: snapshot.description,
    category: snapshot.category,
    tags: structuredClone(snapshot.tags || []),
    template: snapshot.template,
    variables: structuredClone(snapshot.variables || []),
    versions: prompt.versions || [],
    presets: prompt.presets || [],
    lastValues: prompt.lastValues || {},
    lastUsedAt: prompt.lastUsedAt || null
  })
}
