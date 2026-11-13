import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcularContrato,
  type BeneficioInput,
  type ConfigTributariaInput,
  type CustoInput,
  type Demonstracao,
  type PostoInput,
} from "@/domain/calculo";

export interface Orgao { id: string; nome: string; cnpj: string | null; endereco: string | null }

export interface Contrato {
  id: string;
  orgao_id: string;
  numero: string;
  objeto: string | null;
  status: string;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  modo_provisao: "Individual" | "Percentual único";
  perc_provisao_unica: number;
  orgaos: Orgao | null;
}

export type Posto = PostoInput & {
  id: string;
  contrato_id: string;
  funcao: string;
  convencao: string | null;
  adicional_noturno_unit: number;
  dsr_noturno_unit: number;
  intrajornada_diurna_unit: number;
  intrajornada_noturna_unit: number;
};

export type Beneficio = BeneficioInput & { id: string; tipo: string; descricao: string | null };
export type Custo = CustoInput & { id: string; contrato_id: string; tipo: string; descricao: string | null };

export const STATUS = ["Vigente", "Em implantação", "Suspenso", "Encerrado"] as const;

// O Postgres devolve numeric como string; converte os campos numéricos.
function numeros<T extends Record<string, unknown>>(linha: T): T {
  const saida: Record<string, unknown> = { ...linha };
  for (const [k, v] of Object.entries(saida)) {
    if (typeof v === "string" && v !== "" && /^-?\d+(\.\d+)?$/.test(v) && !["numero", "cnpj"].includes(k)) {
      saida[k] = Number(v);
    }
  }
  return saida as T;
}

export async function carregarConfig(sb: SupabaseClient): Promise<ConfigTributariaInput | null> {
  const { data } = await sb.from("config_tributaria").select("*").maybeSingle();
  return data ? numeros(data) as ConfigTributariaInput : null;
}

/** Carrega contratos (opcionalmente um só) com tudo o que o cálculo precisa. */
export async function carregarContratos(sb: SupabaseClient, contratoId?: string) {
  let q = sb.from("contratos").select("*, orgaos(id, nome, cnpj, endereco)").order("criado_em", { ascending: false });
  if (contratoId) q = q.eq("id", contratoId);
  const { data: contratosRaw, error } = await q;
  if (error) throw error;
  const contratos = (contratosRaw ?? []).map((c) => numeros(c)) as Contrato[];
  const ids = contratos.map((c) => c.id);
  if (ids.length === 0) return { contratos: [], postos: [], beneficios: [], custos: [], config: await carregarConfig(sb), calc: new Map<string, Demonstracao>() };

  const [{ data: postosRaw }, { data: custosRaw }, config] = await Promise.all([
    sb.from("postos").select("*").in("contrato_id", ids).order("criado_em"),
    sb.from("custos_operacionais").select("*").in("contrato_id", ids).order("criado_em"),
    carregarConfig(sb),
  ]);
  const postos = (postosRaw ?? []).map((p) => numeros(p)) as Posto[];
  const custos = (custosRaw ?? []).map((c) => numeros(c)) as Custo[];
  const postoIds = postos.map((p) => p.id);
  const { data: bensRaw } = postoIds.length
    ? await sb.from("beneficios").select("*").in("posto_id", postoIds).order("criado_em")
    : { data: [] };
  const beneficios = (bensRaw ?? []).map((b) => numeros(b)) as Beneficio[];

  const calc = new Map<string, Demonstracao>();
  for (const c of contratos) {
    const ps = postos.filter((p) => p.contrato_id === c.id);
    const psIds = new Set(ps.map((p) => p.id));
    calc.set(c.id, calcularContrato(
      c, ps, beneficios.filter((b) => psIds.has(b.posto_id)),
      custos.filter((x) => x.contrato_id === c.id), config,
    ));
  }
  return { contratos, postos, beneficios, custos, config, calc };
}
