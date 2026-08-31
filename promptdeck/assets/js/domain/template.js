export function initialValues(prompt) {
  return Object.fromEntries((prompt.variables || []).map((variable) => [variable.key, variable.defaultValue]))
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

export function createPrompt(data) {
  const now = new Date().toISOString()
  return {
    id: data.id || crypto.randomUUID(),
    title: String(data.title || '').trim(),
    description: String(data.description || '').trim(),
    category: String(data.category || 'Geral').trim() || 'Geral',
    tags: Array.isArray(data.tags) ? data.tags : [],
    favorite: Boolean(data.favorite),
    template: String(data.template || ''),
    variables: Array.isArray(data.variables) ? data.variables : [],
    createdAt: data.createdAt || now,
    updatedAt: now
  }
}
