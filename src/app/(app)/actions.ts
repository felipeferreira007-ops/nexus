"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirModuloContratos } from "@/lib/sessao";
import { lerNumero, lerTexto } from "@/lib/formato";
import { camposPosto24h, type Regime } from "@/domain/calculo";

const REGIMES: Regime[] = ["Normal", "12x36", "24 horas"];

function falhar(caminho: string, msg: string): never {
  const sep = caminho.includes("?") ? "&" : "?";
  redirect(`${caminho}${sep}erro=${encodeURIComponent(msg)}`);
}

function atualizar(contratoId?: string | null) {
  revalidatePath("/contratos");
  revalidatePath("/demonstracao");
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
}

// ---------------- Órgão e contrato ----------------

export async function criarOrgao(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const nome = lerTexto(form.get("nome"));
  if (!nome) falhar("/contratos", "Informe o nome do órgão.");
  const { error } = await supabase.from("orgaos").insert({
    nome, cnpj: lerTexto(form.get("cnpj")), endereco: lerTexto(form.get("endereco")),
  });
  if (error) falhar("/contratos", error.message);
  atualizar();
}

function camposContrato(form: FormData) {
  return {
    orgao_id: lerTexto(form.get("orgao_id")),
    numero: lerTexto(form.get("numero")),
    objeto: lerTexto(form.get("objeto")),
    status: lerTexto(form.get("status")) ?? "Vigente",
    vigencia_inicio: lerTexto(form.get("vigencia_inicio")),
    vigencia_fim: lerTexto(form.get("vigencia_fim")),
    modo_provisao: lerTexto(form.get("modo_provisao")) === "Percentual único" ? "Percentual único" : "Individual",
    perc_provisao_unica: Math.max(0, lerNumero(form.get("perc_provisao_unica"))),
  };
}

export async function criarContrato(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const dados = camposContrato(form);
  if (!dados.orgao_id || !dados.numero) falhar("/contratos", "Informe o órgão e o número do contrato.");
  if (dados.vigencia_inicio && dados.vigencia_fim && dados.vigencia_fim < dados.vigencia_inicio) {
    falhar("/contratos", "O fim da vigência não pode ser antes do início.");
  }
  const { data, error } = await supabase.from("contratos").insert(dados).select("id").single();
  if (error) falhar("/contratos", error.message);
  atualizar();
  redirect(`/contratos/${data.id}`);
}

export async function editarContrato(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const id = String(form.get("id"));
  const volta = `/contratos/${id}`;
  const dados = camposContrato(form);
  if (!dados.orgao_id || !dados.numero) falhar(volta, "Informe o órgão e o número do contrato.");
  if (dados.vigencia_inicio && dados.vigencia_fim && dados.vigencia_fim < dados.vigencia_inicio) {
    falhar(volta, "O fim da vigência não pode ser antes do início.");
  }
  const { error } = await supabase.from("contratos").update(dados).eq("id", id);
  if (error) falhar(volta, error.message);

  // Renomear o órgão altera o cadastro para todos os contratos dele
  const novoNome = lerTexto(form.get("renomear_orgao"));
  if (novoNome) {
    const { error: e2 } = await supabase.from("orgaos").update({ nome: novoNome }).eq("id", dados.orgao_id!);
    if (e2) falhar(volta, e2.message);
  }
  atualizar(id);
}

export async function excluirContrato(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const id = String(form.get("id"));
  const { error } = await supabase.from("contratos").delete().eq("id", id);
  if (error) falhar(`/contratos/${id}`, error.message);
  atualizar();
  redirect("/contratos");
}

// ---------------- Postos ----------------

export async function salvarPosto(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const contratoId = String(form.get("contrato_id"));
  const volta = `/contratos/${contratoId}`;
  const id = lerTexto(form.get("id"));
  const regime = String(form.get("regime")) as Regime;
  if (!REGIMES.includes(regime)) falhar(volta, "Regime inválido.");
  const funcao = lerTexto(form.get("funcao"));
  if (!funcao) falhar(volta, "Informe a função do posto.");

  const unit = {
    adicional_noturno_unit: lerNumero(form.get("adicional_noturno_unit")),
    dsr_noturno_unit: lerNumero(form.get("dsr_noturno_unit")),
    intrajornada_diurna_unit: lerNumero(form.get("intrajornada_diurna_unit")),
    intrajornada_noturna_unit: lerNumero(form.get("intrajornada_noturna_unit")),
  };
  const variaveis = regime === "24 horas"
    ? camposPosto24h(unit)
    : {
        adicional_noturno: lerNumero(form.get("adicional_noturno")),
        dsr_noturno: lerNumero(form.get("dsr_noturno")),
        intrajornada: lerNumero(form.get("intrajornada")),
      };

  const dados = {
    contrato_id: contratoId,
    funcao,
    convencao: lerTexto(form.get("convencao")),
    regime,
    quantidade_postos: Math.max(0, lerNumero(form.get("quantidade_postos"))),
    quantidade_executada: Math.max(0, lerNumero(form.get("quantidade_executada"))),
    valor_unitario_posto: lerNumero(form.get("valor_unitario_posto")),
    salario_base: lerNumero(form.get("salario_base")),
    insalubridade: lerNumero(form.get("insalubridade")),
    periculosidade: lerNumero(form.get("periculosidade")),
    outros_adicionais: lerNumero(form.get("outros_adicionais")),
    ...variaveis,
    ...(regime === "24 horas" ? unit : {
      adicional_noturno_unit: 0, dsr_noturno_unit: 0, intrajornada_diurna_unit: 0, intrajornada_noturna_unit: 0,
    }),
  };

  const { error } = id
    ? await supabase.from("postos").update(dados).eq("id", id)
    : await supabase.from("postos").insert(dados);
  if (error) falhar(volta, error.message);
  atualizar(contratoId);
}

export async function excluirPosto(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const contratoId = String(form.get("contrato_id"));
  // os benefícios do posto saem junto (on delete cascade)
  const { error } = await supabase.from("postos").delete().eq("id", String(form.get("id")));
  if (error) falhar(`/contratos/${contratoId}`, error.message);
  atualizar(contratoId);
}

// ---------------- Benefícios ----------------

export async function salvarBeneficio(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const contratoId = String(form.get("contrato_id"));
  const volta = `/contratos/${contratoId}`;
  const tipo = lerTexto(form.get("tipo"));
  const descricao = lerTexto(form.get("descricao"));
  if (!tipo) falhar(volta, "Escolha o tipo do benefício.");
  if (tipo === "Outro" && !descricao) falhar(volta, "Descreva o benefício do tipo Outro.");
  const { error } = await supabase.from("beneficios").insert({
    posto_id: String(form.get("posto_id")),
    tipo,
    descricao,
    periodicidade: lerTexto(form.get("periodicidade")) === "Mensal" ? "Mensal" : "Diário",
    valor_unitario: lerNumero(form.get("valor_unitario")),
    dias_mes: form.get("dias_mes") ? lerNumero(form.get("dias_mes")) : 22,
    desconto_fixo: lerNumero(form.get("desconto_fixo")),
    desconto_percentual: lerNumero(form.get("desconto_percentual")),
  });
  if (error) falhar(volta, error.message);
  atualizar(contratoId);
}

export async function excluirBeneficio(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const contratoId = String(form.get("contrato_id"));
  const { error } = await supabase.from("beneficios").delete().eq("id", String(form.get("id")));
  if (error) falhar(`/contratos/${contratoId}`, error.message);
  atualizar(contratoId);
}

// ---------------- Custos operacionais ----------------

export async function salvarCusto(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const contratoId = String(form.get("contrato_id"));
  const volta = `/contratos/${contratoId}`;
  const id = lerTexto(form.get("id"));
  const tipo = lerTexto(form.get("tipo"));
  if (!tipo) falhar(volta, "Escolha o tipo do custo.");
  const dados = {
    contrato_id: contratoId,
    tipo,
    descricao: lerTexto(form.get("descricao")),
    valor_mensal: lerNumero(form.get("valor_mensal")),
    origem: tipo === "Materiais" ? "materiais" : "manual",
  };
  const { error } = id
    ? await supabase.from("custos_operacionais").update(dados).eq("id", id)
    : await supabase.from("custos_operacionais").insert(dados);
  if (error) falhar(volta, error.message);
  atualizar(contratoId);
}

export async function excluirCusto(form: FormData) {
  const { supabase } = await exigirModuloContratos();
  const contratoId = String(form.get("contrato_id"));
  const { error } = await supabase.from("custos_operacionais").delete().eq("id", String(form.get("id")));
  if (error) falhar(`/contratos/${contratoId}`, error.message);
  atualizar(contratoId);
}

// ---------------- Configuração tributária ----------------

const CAMPOS_TRIBUTOS = [
  "das", "iss", "pis", "cofins", "cprb", "irpj", "csll",
  "presuncao_irpj", "presuncao_csll", "adicional_irpj", "encargos_sociais",
] as const;

export async function salvarConfigTributaria(form: FormData) {
  const { supabase, empresa } = await exigirModuloContratos();
  const regime = String(form.get("regime"));
  if (!["Simples", "Presumido", "Real"].includes(regime)) falhar("/config-tributaria", "Regime inválido.");
  const dados: Record<string, unknown> = { empresa_id: empresa.id, regime, atualizado_em: new Date().toISOString() };
  for (const c of CAMPOS_TRIBUTOS) {
    const v = lerNumero(form.get(c));
    if (v < 0) falhar("/config-tributaria", "Os percentuais não podem ser negativos.");
    dados[c] = v;
  }
  // Campos que zerariam o cálculo sem o usuário perceber
  if (regime === "Simples" && !(Number(dados.das) > 0)) {
    falhar("/config-tributaria", "No Simples, informe a alíquota efetiva do DAS.");
  }
  if (regime === "Presumido" && (!(Number(dados.presuncao_irpj) > 0) || !(Number(dados.presuncao_csll) > 0))) {
    falhar("/config-tributaria", "No Lucro Presumido, informe a presunção do IRPJ e da CSLL (serviços: 32).");
  }
  if (regime !== "Simples" && !(Number(dados.irpj) > 0) && !(Number(dados.csll) > 0)) {
    falhar("/config-tributaria", "Informe as alíquotas de IRPJ e CSLL.");
  }
  const { error } = await supabase.from("config_tributaria").upsert(dados, { onConflict: "empresa_id" });
  if (error) falhar("/config-tributaria", error.message);
  revalidatePath("/config-tributaria");
  atualizar();
  redirect("/config-tributaria?salvo=1");
}
