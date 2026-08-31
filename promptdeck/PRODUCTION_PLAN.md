# PromptDeck Production v1

## Implementado

- [x] Owner-only auth enforced server-side
- [x] Google OAuth como única opção exibida no app
- [x] Recents and Quick Deck
- [x] Presets and last configuration per prompt
- [x] Copy history with re-copy
- [x] Prompt version snapshots (20 por prompt)
- [x] Encrypted backup/restore UX
- [x] Text importer for Google Docs migration
- [x] Mobile bottom navigation and bottom-sheet configuration
- [x] PWA cache versioning/update behavior
- [x] CSP + noindex + no-referrer
- [x] Cross-device optimistic revision protection
- [x] Security / performance advisors revisados

## Decisões de produção

- Passkeys do Supabase não são habilitadas nesta versão porque o recurso continua marcado como **experimental**. O segredo do Vault pode ser salvo no gerenciador de senhas do sistema e preenchido com Face ID / biometria / Windows Hello sem alterar o modelo criptográfico.
- O frontend usa apenas a publishable key do Supabase. Nunca adicionar `service_role`, secret key, OAuth Client Secret ou segredo do Vault ao GitHub.
- Todo conteúdo de prompt, tags, presets, histórico de cópias, versões e últimas configurações permanece dentro do payload AES-256-GCM.

## Ação manual de painel recomendada

Em **Supabase > Authentication > Providers / Sign In**:

1. manter Google habilitado;
2. desabilitar métodos de login que você não pretende usar (password/email OTP/phone, conforme aparecerem no painel);
3. se login por senha continuar habilitado, habilitar leaked-password protection para eliminar o aviso do Security Advisor.

O owner lock + RLS continuam sendo a autorização efetiva mesmo que outro usuário consiga se autenticar.
