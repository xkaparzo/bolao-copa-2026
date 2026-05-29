# 🚀 Guia de Deploy — Bolão Copa do Mundo 2026

## Pré-requisitos
- Conta no [Supabase](https://supabase.com) (grátis)
- Conta no [Vercel](https://vercel.com) (grátis)
- Conta no [football-data.org](https://www.football-data.org) (grátis)

---

## Passo 1 — Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Dê um nome ao projeto (ex: `bolao-copa-2026`)
3. Aguarde a criação (≈ 2 min)
4. Vá em **SQL Editor** → cole e execute o conteúdo de `supabase/schema.sql`
5. Anote as chaves em **Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

### Configurar autenticação no Supabase
- **Authentication → Settings → Email Auth**: deixar habilitado
- **Authentication → URL Configuration**:
  - Site URL: `https://SEU-PROJETO.vercel.app`
  - Redirect URLs: `https://SEU-PROJETO.vercel.app/**`

---

## Passo 2 — API de Resultados (football-data.org)

1. Acesse [football-data.org](https://www.football-data.org/client/register)
2. Crie uma conta gratuita
3. Copie seu **API Token** → `FOOTBALL_DATA_API_TOKEN`

> ⚠️ O plano gratuito tem limite de 10 requisições/minuto — suficiente para o cron de 30 em 30 minutos.

---

## Passo 3 — Deploy no Vercel

1. Faça push do projeto para um repositório GitHub:
   ```bash
   git add .
   git commit -m "feat: bolão copa 2026"
   git remote add origin https://github.com/SEU-USUARIO/bolao-copa-2026.git
   git push -u origin main
   ```

2. Acesse [vercel.com](https://vercel.com) → **Add New Project** → selecione o repositório

3. Configure as **Environment Variables**:
   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon do Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key do Supabase |
   | `FOOTBALL_DATA_API_TOKEN` | Token da football-data.org |
   | `CRON_SECRET` | Uma senha aleatória (ex: `abc123xyz`) |

4. Clique em **Deploy** ✅

---

## Passo 4 — Configuração inicial do sistema

1. Acesse o sistema pelo link do Vercel
2. **Cadastre-se** com seu email (você será o primeiro usuário)
3. No **Supabase SQL Editor**, execute para se tornar admin:
   ```sql
   UPDATE public.usuarios
   SET is_admin = true
   WHERE email = 'SEU_EMAIL@aqui.com';
   ```
4. Volte ao sistema e acesse **Admin → Configurações**
5. Defina o **total de participantes** (ex: 10 amigos)
6. Peça para os amigos se cadastrarem
7. **Admin → Cadastrar Jogo**: adicione os jogos com seus valores

---

## Passo 5 — Associar jogos à API automática (opcional)

Para que a sincronização automática funcione, você precisa associar cada jogo ao ID da API:

1. Acesse: `https://api.football-data.org/v4/competitions/2000/matches`
   (com header `X-Auth-Token: SEU_TOKEN`)
2. Anote o `id` de cada jogo
3. No Supabase SQL Editor, atualize:
   ```sql
   UPDATE public.jogos
   SET api_match_id = <ID_DA_API>
   WHERE time_casa = 'Brasil' AND time_fora = 'México';
   ```

> 💡 Se preferir, use sempre a atualização manual no painel Admin.

---

## Cron Job (automático)

O `vercel.json` já configura o cron para rodar a cada 30 minutos:
```json
{ "crons": [{ "path": "/api/sync-scores", "schedule": "*/30 * * * *" }] }
```

Isso exige o **plano Hobby do Vercel** (gratuito, mas com limitações) ou **Pro**.
Se preferir 100% manual, basta usar o botão "Sincronizar Agora" no painel Admin.

---

## Estrutura de arquivos

```
bolao-copa-2026/
├── app/
│   ├── auth/login/         # Tela de login
│   ├── auth/register/      # Tela de cadastro
│   ├── dashboard/          # Dashboard principal
│   ├── palpites/           # Inserir palpites
│   ├── jogos/              # Tabela de todos os jogos
│   ├── ranking/            # Ranking + pódio
│   ├── financeiro/         # Extrato + saldos gerais
│   ├── admin/              # Painel de administração
│   └── api/sync-scores/    # API de sincronização de placares
├── components/
│   └── Navbar.tsx          # Barra de navegação
├── lib/
│   └── supabase.ts         # Cliente Supabase + tipos
├── supabase/
│   └── schema.sql          # Schema completo do banco
└── vercel.json             # Config do cron job
```
