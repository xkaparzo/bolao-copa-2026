-- =============================================
-- BOLÃO COPA DO MUNDO 2026 - Schema do Banco
-- Execute no Supabase SQL Editor
-- =============================================

-- Habilitar extensão para UUIDs
create extension if not exists "uuid-ossp";

-- =============================================
-- TABELA: usuarios
-- =============================================
create table if not exists public.usuarios (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  email text not null unique,
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.usuarios enable row level security;

create policy "Usuários podem ver todos os perfis"
  on public.usuarios for select using (true);

create policy "Usuário pode editar próprio perfil"
  on public.usuarios for update using (auth.uid() = id);

create policy "Inserção apenas para usuário autenticado"
  on public.usuarios for insert with check (auth.uid() = id);

-- =============================================
-- TABELA: jogos
-- =============================================
create table if not exists public.jogos (
  id uuid default uuid_generate_v4() primary key,
  fase text not null, -- 'GRUPOS', 'OITAVAS', 'QUARTAS', 'SEMI', 'TERCEIRO', 'FINAL'
  grupo text, -- 'A', 'B', ..., 'H' (apenas na fase de grupos)
  time_casa text not null,
  time_fora text not null,
  bandeira_casa text, -- código ISO do país (ex: 'BR', 'AR')
  bandeira_fora text,
  data_hora timestamptz not null,
  gols_casa integer,
  gols_fora integer,
  status text not null default 'AGENDADO', -- 'AGENDADO', 'AO_VIVO', 'ENCERRADO'
  valor_por_participante numeric(10,2) not null default 10.00,
  pote_acumulado numeric(10,2) not null default 0.00, -- acumulado de jogos anteriores sem ganhador
  pote_total numeric(10,2) not null default 0.00,     -- valor_por_participante * total_participantes + pote_acumulado
  api_match_id integer, -- ID na football-data.org
  created_at timestamptz default now()
);

alter table public.jogos enable row level security;

create policy "Todos podem ver jogos"
  on public.jogos for select using (true);

create policy "Apenas admin pode inserir/editar jogos"
  on public.jogos for all using (
    exists (select 1 from public.usuarios where id = auth.uid() and is_admin = true)
  );

-- =============================================
-- TABELA: palpites
-- =============================================
create table if not exists public.palpites (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  jogo_id uuid references public.jogos(id) on delete cascade not null,
  palpite_casa integer not null check (palpite_casa >= 0),
  palpite_fora integer not null check (palpite_fora >= 0),
  acertou_exato boolean,
  ganho numeric(10,2),
  created_at timestamptz default now(),
  unique(user_id, jogo_id) -- um palpite por usuário por jogo
);

alter table public.palpites enable row level security;

create policy "Usuários veem todos palpites de jogos encerrados"
  on public.palpites for select using (
    exists (select 1 from public.jogos where id = jogo_id and status = 'ENCERRADO')
    or user_id = auth.uid()
  );

create policy "Usuário pode inserir próprio palpite"
  on public.palpites for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.jogos
      where id = jogo_id
        and status = 'AGENDADO'
        and data_hora > now() + interval '5 minutes'
    )
  );

create policy "Usuário pode atualizar palpite antes do prazo"
  on public.palpites for update using (
    user_id = auth.uid()
    and exists (
      select 1 from public.jogos
      where id = jogo_id
        and status = 'AGENDADO'
        and data_hora > now() + interval '5 minutes'
    )
  );

create policy "Admin pode atualizar palpites (processar resultado)"
  on public.palpites for update using (
    exists (select 1 from public.usuarios where id = auth.uid() and is_admin = true)
  );

-- =============================================
-- TABELA: financeiro
-- =============================================
create table if not exists public.financeiro (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  jogo_id uuid references public.jogos(id) on delete cascade not null,
  tipo text not null check (tipo in ('DEBITO', 'CREDITO')),
  valor numeric(10,2) not null,
  descricao text not null,
  created_at timestamptz default now()
);

alter table public.financeiro enable row level security;

create policy "Usuário vê próprio extrato"
  on public.financeiro for select using (user_id = auth.uid());

create policy "Admin vê todo extrato"
  on public.financeiro for select using (
    exists (select 1 from public.usuarios where id = auth.uid() and is_admin = true)
  );

create policy "Apenas admin pode inserir registros financeiros"
  on public.financeiro for insert with check (
    exists (select 1 from public.usuarios where id = auth.uid() and is_admin = true)
  );

-- =============================================
-- TABELA: config
-- =============================================
create table if not exists public.config (
  chave text primary key,
  valor text not null
);

alter table public.config enable row level security;

create policy "Todos podem ler configurações"
  on public.config for select using (true);

create policy "Apenas admin pode alterar configurações"
  on public.config for all using (
    exists (select 1 from public.usuarios where id = auth.uid() and is_admin = true)
  );

-- Inserir configurações padrão
insert into public.config (chave, valor) values
  ('nome_bolao', 'Bolão Copa do Mundo 2026'),
  ('total_participantes', '0'),
  ('api_football_token', '')
on conflict (chave) do nothing;

-- =============================================
-- VIEWS ÚTEIS
-- =============================================

-- Saldo por usuário
create or replace view public.saldos_usuarios as
select
  u.id as user_id,
  u.nome,
  u.email,
  coalesce(sum(case when f.tipo = 'CREDITO' then f.valor else 0 end), 0) as total_ganho,
  coalesce(sum(case when f.tipo = 'DEBITO' then f.valor else 0 end), 0) as total_pago,
  coalesce(sum(case when f.tipo = 'CREDITO' then f.valor else -f.valor end), 0) as saldo_final
from public.usuarios u
left join public.financeiro f on f.user_id = u.id
group by u.id, u.nome, u.email
order by saldo_final desc;

-- =============================================
-- FUNCTION: processar resultado de um jogo
-- =============================================
create or replace function public.processar_resultado_jogo(p_jogo_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_jogo record;
  v_total_participantes integer;
  v_ganhadores_count integer;
  v_pote_por_ganhador numeric(10,2);
  v_pote_total numeric(10,2);
  v_proximo_jogo_id uuid;
  v_rec record;
begin
  -- Buscar dados do jogo
  select * into v_jogo from public.jogos where id = p_jogo_id;

  if v_jogo.status != 'ENCERRADO' then
    raise exception 'Jogo ainda não encerrado';
  end if;

  -- Total de participantes (da config)
  select valor::integer into v_total_participantes
  from public.config where chave = 'total_participantes';

  -- Calcular pote total do jogo
  v_pote_total := (v_jogo.valor_por_participante * v_total_participantes) + v_jogo.pote_acumulado;

  -- Atualizar pote_total no jogo
  update public.jogos set pote_total = v_pote_total where id = p_jogo_id;

  -- Registrar DÉBITO para todos os participantes
  for v_rec in select id from public.usuarios loop
    -- Evitar duplo processamento
    if not exists (
      select 1 from public.financeiro
      where user_id = v_rec.id and jogo_id = p_jogo_id
    ) then
      insert into public.financeiro (user_id, jogo_id, tipo, valor, descricao)
      values (
        v_rec.id, p_jogo_id, 'DEBITO',
        v_jogo.valor_por_participante,
        'Participação: ' || v_jogo.time_casa || ' x ' || v_jogo.time_fora
      );
    end if;
  end loop;

  -- Marcar palpites corretos
  update public.palpites
  set acertou_exato = (palpite_casa = v_jogo.gols_casa and palpite_fora = v_jogo.gols_fora)
  where jogo_id = p_jogo_id;

  -- Contar ganhadores
  select count(*) into v_ganhadores_count
  from public.palpites
  where jogo_id = p_jogo_id and acertou_exato = true;

  if v_ganhadores_count > 0 then
    -- Dividir pote igualmente
    v_pote_por_ganhador := round(v_pote_total / v_ganhadores_count, 2);

    for v_rec in
      select user_id from public.palpites
      where jogo_id = p_jogo_id and acertou_exato = true
    loop
      -- Atualizar ganho no palpite
      update public.palpites
      set ganho = v_pote_por_ganhador
      where jogo_id = p_jogo_id and user_id = v_rec.user_id;

      -- Registrar CRÉDITO
      insert into public.financeiro (user_id, jogo_id, tipo, valor, descricao)
      values (
        v_rec.user_id, p_jogo_id, 'CREDITO',
        v_pote_por_ganhador,
        'Acertou o placar! ' || v_jogo.time_casa || ' ' || v_jogo.gols_casa || 'x' || v_jogo.gols_fora || ' ' || v_jogo.time_fora
      );
    end loop;

    -- Zerar acumulado (foi distribuído)
    -- O próximo jogo começa do zero
  else
    -- Sem ganhadores: acumula para o próximo jogo
    -- Buscar próximo jogo agendado
    select id into v_proximo_jogo_id
    from public.jogos
    where status = 'AGENDADO'
    order by data_hora asc
    limit 1;

    if v_proximo_jogo_id is not null then
      update public.jogos
      set pote_acumulado = pote_acumulado + v_pote_total
      where id = v_proximo_jogo_id;
    end if;
  end if;
end;
$$;
