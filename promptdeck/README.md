# PromptDeck

Cofre privado de prompts, responsivo para celular e PC, pensado para GitHub Pages + Supabase.

## Estado atual

- PWA instalável e sem build obrigatório.
- Layout desktop e mobile.
- Cofre client-side AES-256-GCM.
- PBKDF2-SHA-256 com salt aleatório para derivar a chave.
- Cadastro, edição, exclusão e favoritos.
- Filtro de favoritos e busca local.
- Prompt simples: copiar com um toque.
- Prompt parametrizado: `{{chave}}`, lista, texto e toggle.
- Preview antes de copiar.
- Exportação e importação de backup cifrado.
- Bloqueio automático do cofre após 15 minutos de inatividade.
- Fallback de clipboard para navegadores móveis.
- Integração preparada com Supabase Auth + Postgres/RLS.
- Schema com allowlist server-side.

## Regra central de segurança

**Nenhum prompt real entra no repositório.**

GitHub Pages recebe somente HTML/CSS/JavaScript. O banco recebe um envelope cifrado. O segredo do cofre permanece somente na memória do navegador enquanto o Vault está desbloqueado.

`config.js` pode conter apenas configuração pública: URL do Supabase e publishable key. Nunca coloque `service_role`, senha, Vault Key ou prompt nesse arquivo.

## Rodar localmente

```bash
python -m http.server 8080
```

Sem Supabase configurado, o sistema salva somente o envelope cifrado no `localStorage`.

## Conectar Supabase

1. Criar um projeto Supabase exclusivo para PromptDeck.
2. Aplicar `supabase.sql`.
3. Inserir manualmente o e-mail autorizado em `public.allowed_users` no SQL Editor.
4. Ativar Google em Authentication > Providers.
5. Configurar a URL do GitHub Pages como Site URL / Redirect URL.
6. Preencher `config.js` somente com `supabaseUrl` e `supabasePublishableKey`.

## Modelo de ameaça

O JavaScript de uma aplicação web é público por natureza. A segurança não depende de escondê-lo. Ela depende de autenticação, allowlist server-side, RLS por `auth.uid()`, criptografia no dispositivo e ausência da Vault Key no servidor.

## Próximas etapas

- Projeto Supabase dedicado e sincronização real PC ↔ celular.
- Recovery kit cifrado.
- WebAuthn/passkey para reduzir a necessidade de digitar o segredo do Vault.
- Presets, blocos reutilizáveis e histórico de uso.
