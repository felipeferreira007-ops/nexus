-- NEXUS · Módulo de Gestão de Contratos · núcleo
-- Multiempresa: todo registro carrega empresa_id e o RLS só libera a empresa do usuário logado.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Empresa e vínculo do usuário
-- ---------------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj text not null,
  endereco text,
  acesso_contratos_ate date,
  patrimonio_liquido numeric(14,2),
  receita_bruta numeric(14,2),
  modo_declaracao text not null default 'anual' check (modo_declaracao in ('anual','remanescente')),
  criado_em timestamptz not null default now()
);

create table public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  papel text not null default 'principal' check (papel in ('principal','funcionario')),
  modulos_liberados text[] not null default '{contratos}',
  criado_em timestamptz not null default now()
);

-- Empresa do usuário logado (usada em todas as políticas)
create or replace function public.minha_empresa() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from public.perfis where user_id = auth.uid()
$$;

-- Cria a empresa e o perfil principal no primeiro acesso (30 dias de teste)
create or replace function public.criar_empresa(p_razao_social text, p_cnpj text, p_endereco text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if exists (select 1 from perfis where user_id = auth.uid()) then
    raise exception 'usuário já vinculado a uma empresa';
  end if;
  insert into empresas (razao_social, cnpj, endereco, acesso_contratos_ate)
    values (p_razao_social, p_cnpj, p_endereco, current_date + 30)
    returning id into v_id;
  insert into perfis (user_id, empresa_id, papel) values (auth.uid(), v_id, 'principal');
  return v_id;
end $$;

-- ---------------------------------------------------------------
-- Cadastros do módulo
-- ---------------------------------------------------------------
create table public.orgaos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas(id) on delete cascade,
  nome text not null,
  cnpj text,
  endereco text,
  criado_em timestamptz not null default now()
);

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas(id) on delete cascade,
  orgao_id uuid not null references public.orgaos(id) on delete restrict,
  numero text not null,
  objeto text,
  status text not null default 'Vigente' check (status in ('Vigente','Em implantação','Suspenso','Encerrado')),
  vigencia_inicio date,
  vigencia_fim date,
  valor_anual numeric(14,2),
  modo_provisao text not null default 'Individual' check (modo_provisao in ('Individual','Percentual único')),
  perc_provisao_unica numeric(7,4) not null default 0 check (perc_provisao_unica >= 0),
  criado_em timestamptz not null default now()
);

create table public.postos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas(id) on delete cascade,
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  funcao text not null,
  convencao text,
  regime text not null default 'Normal' check (regime in ('Normal','12x36','24 horas')),
  quantidade_postos numeric(10,2) not null default 1 check (quantidade_postos >= 0),
  quantidade_executada numeric(10,2) not null default 1 check (quantidade_executada >= 0),
  valor_unitario_posto numeric(14,2) not null default 0,
  salario_base numeric(14,2) not null default 0,
  insalubridade numeric(14,2) not null default 0,
  periculosidade numeric(14,2) not null default 0,
  outros_adicionais numeric(14,2) not null default 0,
  -- valores do posto (12x36: já somados; 24h: derivados das unidades abaixo)
  adicional_noturno numeric(14,2) not null default 0,
  dsr_noturno numeric(14,2) not null default 0,
  intrajornada numeric(14,2) not null default 0,
  -- 24 horas: valores de 1 funcionário
  adicional_noturno_unit numeric(14,2) not null default 0,
  dsr_noturno_unit numeric(14,2) not null default 0,
  intrajornada_diurna_unit numeric(14,2) not null default 0,
  intrajornada_noturna_unit numeric(14,2) not null default 0,
  criado_em timestamptz not null default now()
);

create table public.beneficios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas(id) on delete cascade,
  posto_id uuid not null references public.postos(id) on delete cascade,
  tipo text not null,
  descricao text,
  periodicidade text not null default 'Diário' check (periodicidade in ('Diário','Mensal')),
  valor_unitario numeric(14,2) not null default 0,
  dias_mes numeric(5,2) not null default 22,
  desconto_fixo numeric(14,2) not null default 0,
  desconto_percentual numeric(7,4) not null default 0,
  criado_em timestamptz not null default now(),
  constraint outro_exige_descricao check (tipo <> 'Outro' or coalesce(trim(descricao),'') <> '')
);

create table public.custos_operacionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas(id) on delete cascade,
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  tipo text not null,
  descricao text,
  valor_mensal numeric(14,2) not null default 0,
  origem text not null default 'manual' check (origem in ('manual','materiais')),
  criado_em timestamptz not null default now()
);

create table public.config_tributaria (
  empresa_id uuid primary key default public.minha_empresa() references public.empresas(id) on delete cascade,
  regime text not null default 'Simples' check (regime in ('Simples','Presumido','Real')),
  das numeric(7,4) not null default 0 check (das >= 0),
  iss numeric(7,4) not null default 0 check (iss >= 0),
  pis numeric(7,4) not null default 0 check (pis >= 0),
  cofins numeric(7,4) not null default 0 check (cofins >= 0),
  cprb numeric(7,4) not null default 0 check (cprb >= 0),
  irpj numeric(7,4) not null default 0 check (irpj >= 0),
  csll numeric(7,4) not null default 0 check (csll >= 0),
  presuncao_irpj numeric(7,4) not null default 0 check (presuncao_irpj >= 0),
  presuncao_csll numeric(7,4) not null default 0 check (presuncao_csll >= 0),
  adicional_irpj numeric(7,4) not null default 0 check (adicional_irpj >= 0),
  encargos_sociais numeric(7,4) not null default 0 check (encargos_sociais >= 0),
  atualizado_em timestamptz not null default now()
);

create index on public.contratos (empresa_id);
create index on public.postos (contrato_id);
create index on public.beneficios (posto_id);
create index on public.custos_operacionais (contrato_id);

-- ---------------------------------------------------------------
-- Segurança: Row Level Security por empresa
-- ---------------------------------------------------------------
alter table public.empresas enable row level security;
alter table public.perfis enable row level security;
alter table public.orgaos enable row level security;
alter table public.contratos enable row level security;
alter table public.postos enable row level security;
alter table public.beneficios enable row level security;
alter table public.custos_operacionais enable row level security;
alter table public.config_tributaria enable row level security;

create policy empresa_ler on public.empresas for select using (id = public.minha_empresa());
create policy empresa_editar on public.empresas for update using (id = public.minha_empresa())
  with check (id = public.minha_empresa());

create policy perfil_ler on public.perfis for select using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['orgaos','contratos','postos','beneficios','custos_operacionais','config_tributaria'] loop
    execute format(
      'create policy %1$s_empresa on public.%1$s for all
         using (empresa_id = public.minha_empresa())
         with check (empresa_id = public.minha_empresa())', t);
  end loop;
end $$;

-- O usuário não pode alterar o próprio prazo de acesso pelo app:
-- tira o UPDATE da tabela inteira e devolve só nas colunas editáveis.
revoke update on public.empresas from authenticated, anon;
grant update (razao_social, cnpj, endereco, patrimonio_liquido, receita_bruta, modo_declaracao)
  on public.empresas to authenticated;

-- ---------------------------------------------------------------
-- Consistência: registro filho sempre da mesma empresa do pai
-- (impede ligar um posto/custo a contrato de outra empresa pelo id)
-- ---------------------------------------------------------------
create or replace function public.checar_empresa_pai() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pai uuid;
begin
  if tg_table_name = 'contratos' then
    select empresa_id into v_pai from orgaos where id = new.orgao_id;
  elsif tg_table_name in ('postos', 'custos_operacionais') then
    select empresa_id into v_pai from contratos where id = new.contrato_id;
  elsif tg_table_name = 'beneficios' then
    select empresa_id into v_pai from postos where id = new.posto_id;
  end if;
  if v_pai is distinct from new.empresa_id then
    raise exception 'registro vinculado a outra empresa';
  end if;
  return new;
end $$;

create trigger contratos_empresa before insert or update on public.contratos
  for each row execute function public.checar_empresa_pai();
create trigger postos_empresa before insert or update on public.postos
  for each row execute function public.checar_empresa_pai();
create trigger custos_empresa before insert or update on public.custos_operacionais
  for each row execute function public.checar_empresa_pai();
create trigger beneficios_empresa before insert or update on public.beneficios
  for each row execute function public.checar_empresa_pai();
