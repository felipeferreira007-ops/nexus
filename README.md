# Nexus · Gestão de Contratos

Módulo de viabilidade econômica dos contratos de terceirização com órgãos públicos.
Next.js 15 + Supabase (Postgres + login), multiempresa com isolamento por empresa no banco (RLS).

## O que já tem (fase 1 · núcleo)

- Login, cadastro da empresa e 30 dias de teste
- Órgãos e contratos (filtro por órgão e status, vigência com alerta de 90/60/30 dias)
- Postos de trabalho nos regimes Normal, 12x36 e 24 horas, com quantidade prevista (faturamento) e executada (custo)
- Benefícios por posto (diário ou mensal, com descontos fixo e % sobre o salário)
- Custos operacionais (uniformes, materiais, equipamentos, EPIs, ASO)
- Configuração tributária: Simples, Presumido ou Real
- Demonstração do resultado mensal por contrato e demonstração financeira consolidada

## Próximas fases

Demandas, documentos e prorrogação, faturamento, declaração de contratos (Anexo VII-E),
habilitação com pacote em PDF, equipe e permissões por módulo, alertas por e-mail,
importação do módulo de materiais.

## Como publicar (Supabase + Vercel)

1. **Supabase**: crie um projeto em supabase.com. Em *SQL Editor*, cole e rode
   `supabase/migrations/0001_gestao_contratos.sql`.
2. Em *Project Settings → API*, copie a **Project URL** e a chave **anon public**.
3. **Vercel**: em vercel.com, *Add New → Project*, importe este repositório do GitHub
   e cadastre as duas variáveis do `.env.example` com os valores do passo 2. Clique em *Deploy*.
4. No Supabase, em *Authentication → URL Configuration*, coloque o endereço da Vercel em *Site URL*.

## Rodar no computador

```bash
cp .env.example .env.local   # preencha com os dados do Supabase
npm install
npm run dev                  # abre em http://localhost:3000
npm test                     # testes do motor de cálculo
```

## Onde está cada coisa

| Pasta | Conteúdo |
|---|---|
| `src/domain/calculo.ts` | Motor de cálculo (todas as fórmulas) e seus testes |
| `src/app/(app)/` | Telas do módulo e ações de gravação (`actions.ts`) |
| `src/lib/` | Acesso ao banco, sessão e formatação |
| `supabase/migrations/` | Estrutura do banco e regras de segurança |

## Regras de cálculo

- **Folha do posto** = (salário + insalubridade + periculosidade + outros) × qtd. executada × fator do regime
  + (adicional noturno + DSR noturno + intrajornada) × qtd. executada. Fator: Normal 1, 12x36 2, 24h 4.
  No 24h os valores noturnos e de intrajornada são de 1 funcionário e o sistema multiplica por 2.
- **Receita** = valor do posto × qtd. prevista.
- **FGTS** 8% da folha; **encargos** = folha × % da configuração tributária.
- **Benefícios** = valor × dias (ou 1, se mensal) × funcionários equivalentes − descontos (nunca negativo).
- **Provisões individuais** = 13º (folha/12) + férias (folha/12) + 1/3 (folha/36) + FGTS sobre essas verbas
  + multa de 40% sobre o FGTS total. Ou percentual único sobre a folha.
- **Tributos** no Simples = receita × DAS; nos demais = receita × (PIS + COFINS + ISS + CPRB).
- **IRPJ/CSLL**: Real sobre o lucro (sem imposto se houver prejuízo); Presumido sobre a receita × presunção.
  Adicional de IRPJ acima de R$ 20.000/mês, calculado por contrato (estimativa).
