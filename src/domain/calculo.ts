/**
 * Motor de cálculo do contrato (Gestão de Contratos · NEXUS).
 * Função pura: recebe os dados e devolve a demonstração do resultado mensal.
 * Percentuais chegam em pontos percentuais (6 = 6%).
 */

export type Regime = "Normal" | "12x36" | "24 horas";

export const FATOR_REGIME: Record<Regime, number> = {
  Normal: 1,
  "12x36": 2,
  "24 horas": 4,
};

export interface PostoInput {
  id?: string;
  funcao?: string;
  regime: Regime;
  quantidade_postos: number; // prevista: base do faturamento
  quantidade_executada: number; // executada: base do custo
  valor_unitario_posto: number;
  salario_base: number;
  insalubridade: number;
  periculosidade: number;
  outros_adicionais: number;
  adicional_noturno: number;
  dsr_noturno: number;
  intrajornada: number;
}

export interface BeneficioInput {
  posto_id: string;
  periodicidade: "Diário" | "Mensal";
  valor_unitario: number;
  dias_mes: number;
  desconto_fixo: number; // por empregado
  desconto_percentual: number; // % sobre o salário base
}

export interface CustoInput {
  valor_mensal: number;
  origem?: "manual" | "materiais";
}

export interface ConfigTributariaInput {
  regime: "Simples" | "Presumido" | "Real";
  das: number;
  iss: number;
  pis: number;
  cofins: number;
  cprb: number;
  irpj: number;
  csll: number;
  presuncao_irpj: number;
  presuncao_csll: number;
  adicional_irpj: number;
  encargos_sociais: number;
}

export interface ContratoInput {
  modo_provisao: "Individual" | "Percentual único";
  perc_provisao_unica: number;
}

export const CONFIG_ZERADA: ConfigTributariaInput = {
  regime: "Simples",
  das: 0, iss: 0, pis: 0, cofins: 0, cprb: 0, irpj: 0, csll: 0,
  presuncao_irpj: 0, presuncao_csll: 0, adicional_irpj: 0, encargos_sociais: 0,
};

/** Limite mensal acima do qual incide o adicional de IRPJ. */
export const LIMITE_ADICIONAL_IRPJ = 20000;

const pct = (v: number) => (Number(v) || 0) / 100;
const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Valores do posto 24h a partir dos campos de 1 funcionário (2 noturnos no posto). */
export function camposPosto24h(unit: {
  adicional_noturno_unit: number;
  dsr_noturno_unit: number;
  intrajornada_diurna_unit: number;
  intrajornada_noturna_unit: number;
}) {
  return {
    adicional_noturno: r2(n(unit.adicional_noturno_unit) * 2),
    dsr_noturno: r2(n(unit.dsr_noturno_unit) * 2),
    intrajornada: r2((n(unit.intrajornada_diurna_unit) + n(unit.intrajornada_noturna_unit)) * 2),
  };
}

export function funcionariosEquivalentes(p: Pick<PostoInput, "regime" | "quantidade_executada">) {
  return n(p.quantidade_executada) * FATOR_REGIME[p.regime];
}

export function folhaPosto(p: PostoInput): number {
  const fator = FATOR_REGIME[p.regime];
  const qtd = n(p.quantidade_executada);
  const fixos = n(p.salario_base) + n(p.insalubridade) + n(p.periculosidade) + n(p.outros_adicionais);
  const variaveis = n(p.adicional_noturno) + n(p.dsr_noturno) + n(p.intrajornada);
  return fixos * qtd * fator + variaveis * qtd;
}

export function receitaPosto(p: PostoInput): number {
  return n(p.valor_unitario_posto) * n(p.quantidade_postos);
}

/**
 * Custo mensal de um benefício no posto.
 * Bruto = valor × (dias ou 1) × funcionários equivalentes; descontos idem, limitados ao bruto.
 */
export function custoBeneficio(b: BeneficioInput, posto: PostoInput): number {
  const pessoas = funcionariosEquivalentes(posto);
  const qtdMes = b.periodicidade === "Mensal" ? 1 : n(b.dias_mes);
  const bruto = n(b.valor_unitario) * qtdMes * pessoas;
  const desconto = (n(b.desconto_fixo) + pct(b.desconto_percentual) * n(posto.salario_base)) * pessoas;
  return Math.max(0, bruto - desconto);
}

export interface Demonstracao {
  receita: number;
  folha: number;
  fgts: number;
  encargos: number;
  beneficios: number;
  provisoes: number;
  provisoesDetalhe: {
    decimoTerceiro: number;
    ferias: number;
    tercoFerias: number;
    fgtsSobreVerbas: number;
    multaFgts: number;
  } | null;
  custosOperacionais: number;
  materiais: number;
  tributos: number;
  lucroAntesIR: number;
  irpj: number;
  adicionalIrpj: number;
  csll: number;
  impostosLucro: number;
  resultado: number;
  custoMaoDeObra: number;
  custoTotal: number;
  margem: number; // %
  porPosto: Array<{
    id?: string;
    funcao?: string;
    folha: number;
    receita: number;
    beneficios: number;
    funcionarios: number;
  }>;
}

export function calcularContrato(
  contrato: ContratoInput,
  postos: PostoInput[],
  beneficios: BeneficioInput[],
  custos: CustoInput[],
  configIn?: ConfigTributariaInput | null,
): Demonstracao {
  const cfg = configIn ?? CONFIG_ZERADA;

  const porPosto = postos.map((p) => {
    const bens = beneficios.filter((b) => b.posto_id === p.id);
    return {
      id: p.id,
      funcao: p.funcao,
      folha: folhaPosto(p),
      receita: receitaPosto(p),
      beneficios: bens.reduce((s, b) => s + custoBeneficio(b, p), 0),
      funcionarios: funcionariosEquivalentes(p),
    };
  });

  const receita = porPosto.reduce((s, p) => s + p.receita, 0);
  const folha = porPosto.reduce((s, p) => s + p.folha, 0);
  const beneficiosTotal = porPosto.reduce((s, p) => s + p.beneficios, 0);
  const fgts = folha * 0.08;
  const encargos = folha * pct(cfg.encargos_sociais);

  let provisoes: number;
  let provisoesDetalhe: Demonstracao["provisoesDetalhe"] = null;
  if (contrato.modo_provisao === "Percentual único") {
    provisoes = folha * pct(contrato.perc_provisao_unica);
  } else {
    const decimoTerceiro = folha / 12;
    const ferias = folha / 12;
    const tercoFerias = folha / 36;
    const fgtsSobreVerbas = (decimoTerceiro + ferias + tercoFerias) * 0.08;
    const multaFgts = (fgts + fgtsSobreVerbas) * 0.4;
    provisoes = decimoTerceiro + ferias + tercoFerias + fgtsSobreVerbas + multaFgts;
    provisoesDetalhe = { decimoTerceiro, ferias, tercoFerias, fgtsSobreVerbas, multaFgts };
  }

  const custosOperacionais = custos.reduce((s, c) => s + n(c.valor_mensal), 0);
  const materiais = custos.filter((c) => c.origem === "materiais").reduce((s, c) => s + n(c.valor_mensal), 0);

  const tributos =
    cfg.regime === "Simples"
      ? receita * pct(cfg.das)
      : receita * (pct(cfg.pis) + pct(cfg.cofins) + pct(cfg.iss) + pct(cfg.cprb));

  const custoMaoDeObra = folha + fgts + encargos + beneficiosTotal + provisoes;
  const lucroAntesIR = receita - (custoMaoDeObra + custosOperacionais + tributos);

  let irpj = 0, adicionalIrpj = 0, csll = 0;
  if (cfg.regime === "Real") {
    const base = Math.max(0, lucroAntesIR);
    irpj = base * pct(cfg.irpj);
    adicionalIrpj = Math.max(0, base - LIMITE_ADICIONAL_IRPJ) * pct(cfg.adicional_irpj);
    csll = base * pct(cfg.csll);
  } else if (cfg.regime === "Presumido") {
    const baseIr = receita * pct(cfg.presuncao_irpj);
    irpj = baseIr * pct(cfg.irpj);
    adicionalIrpj = Math.max(0, baseIr - LIMITE_ADICIONAL_IRPJ) * pct(cfg.adicional_irpj);
    csll = receita * pct(cfg.presuncao_csll) * pct(cfg.csll);
  }
  const impostosLucro = irpj + adicionalIrpj + csll;
  const resultado = lucroAntesIR - impostosLucro;
  const custoTotal = custoMaoDeObra + custosOperacionais + tributos + impostosLucro;

  return {
    receita, folha, fgts, encargos, beneficios: beneficiosTotal,
    provisoes, provisoesDetalhe, custosOperacionais, materiais, tributos,
    lucroAntesIR, irpj, adicionalIrpj, csll, impostosLucro, resultado,
    custoMaoDeObra, custoTotal,
    margem: receita > 0 ? (resultado / receita) * 100 : 0,
    porPosto,
  };
}

export function somarDemonstracoes(lista: Demonstracao[]) {
  const soma = (k: keyof Demonstracao) => lista.reduce((s, d) => s + (d[k] as number), 0);
  const receita = soma("receita");
  const resultado = soma("resultado");
  return {
    receita,
    custoMaoDeObra: soma("custoMaoDeObra"),
    custosOperacionais: soma("custosOperacionais"),
    tributos: soma("tributos"),
    lucroAntesIR: soma("lucroAntesIR"),
    impostosLucro: soma("impostosLucro"),
    resultado,
    margem: receita > 0 ? (resultado / receita) * 100 : 0,
  };
}
