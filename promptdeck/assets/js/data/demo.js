export function createDemoPrompts() {
  const now = new Date().toISOString()
  return [
    {
      id: 'demo-studio',
      title: 'Retrato de estúdio',
      description: 'Exemplo parametrizado. Nenhum prompt real seu está incluído.',
      category: 'Imagem',
      tags: ['foto', 'retrato', 'template'],
      favorite: true,
      template: 'Create a realistic studio portrait.\n\nPOSE:\n{{pose}}\n\nLIGHTING:\n{{lighting}}\n\nEXPRESSION:\n{{expression}}',
      variables: [
        { id: 'pose', key: 'pose', label: 'Pose', type: 'select', defaultValue: 'Seated facing the camera', options: [
          { label: 'Sentada frontal', value: 'Seated facing the camera' },
          { label: 'Em pé, relaxada', value: 'Standing naturally with a relaxed posture' },
          { label: 'Perfil', value: 'Body turned in profile while looking toward the camera' }
        ]},
        { id: 'lighting', key: 'lighting', label: 'Iluminação', type: 'select', defaultValue: 'Soft diffused studio lighting', options: [
          { label: 'Softbox suave', value: 'Soft diffused studio lighting' },
          { label: 'Dramática lateral', value: 'Dramatic side lighting with controlled shadows' },
          { label: 'Natural', value: 'Natural window light' }
        ]},
        { id: 'expression', key: 'expression', label: 'Expressão', type: 'select', defaultValue: 'Neutral, relaxed expression', options: [
          { label: 'Neutra', value: 'Neutral, relaxed expression' },
          { label: 'Sorriso discreto', value: 'A subtle natural smile' },
          { label: 'Séria', value: 'A serious, confident expression' }
        ]}
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-simple',
      title: 'Prompt simples',
      description: 'Clique no card e ele vai direto para a área de transferência.',
      category: 'Geral',
      tags: ['simples'],
      favorite: false,
      template: 'Este é somente um prompt fictício de demonstração do PromptDeck.',
      variables: [],
      createdAt: now,
      updatedAt: now
    }
  ]
}
