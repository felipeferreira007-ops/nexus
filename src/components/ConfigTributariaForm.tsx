"use client";

import { useState } from "react";

type Regime = "Simples" | "Presumido" | "Real";
type Valores = Record<string, number | string>;

interface Campo { nome: string; rotulo: string; dica?: string; padrao?: Partial<Record<Regime, number>> }

const SOBRE_FATURAMENTO: Campo[] = [
  { nome: "pis", rotulo: "PIS", dica: "Presumido: 0,65 (cumulativo). Real: 1,65 menos créditos." , padrao: { Presumido: 0.65, Real: 1.65 } },
  { nome: "cofins", rotulo: "COFINS", dica: "Presumido: 3,00 (cumulativo). Real: 7,60 menos créditos.", padrao: { Presumido: 3, Real: 7.6 } },
  { nome: "iss", rotulo: "ISS", dica: "Alíquota do município (2 a 5)." },
  { nome: "cprb", rotulo: "CPRB", dica: "Só se a empresa for desonerada." },
];

const SOBRE_LUCRO: Campo[] = [
  { nome: "irpj", rotulo: "IRPJ", dica: "Normalmente 15.", padrao: { Presumido: 15, Real: 15 } },
  { nome: "adicional_irpj", rotulo: "Adicional de IRPJ", dica: "Normalmente 10, sobre o que passar de R$ 20.000 por mês.", padrao: { Presumido: 10, Real: 10 } },
  { nome: "csll", rotulo: "CSLL", dica: "Normalmente 9.", padrao: { Presumido: 9, Real: 9 } },
];

const PRESUNCAO: Campo[] = [
  { nome: "presuncao_irpj", rotulo: "Presunção do IRPJ", dica: "Serviços: 32.", padrao: { Presumido: 32 } },
  { nome: "presuncao_csll", rotulo: "Presunção da CSLL", dica: "Serviços: 32.", padrao: { Presumido: 32 } },
];

const fmt = (v: unknown) => String(v ?? 0).replace(".", ",");

function Campos({ lista, valores, regime }: { lista: Campo[]; valores: Valores; regime: Regime }) {
  return (
    <div className="grade">
      {lista.map((c) => {
        const atual = Number(valores[c.nome] ?? 0);
        const inicial = atual === 0 && c.padrao?.[regime] ? c.padrao[regime] : atual;
        return (
          <label key={`${regime}-${c.nome}`}>
            {c.rotulo} (%)
            <input name={c.nome} inputMode="decimal" defaultValue={fmt(inicial)} required />
            {c.dica && <span className="mini">{c.dica}</span>}
          </label>
        );
      })}
    </div>
  );
}

export function ConfigTributariaForm({
  action,
  valores,
}: {
  action: (form: FormData) => void | Promise<void>;
  valores: Valores;
}) {
  const [regime, setRegime] = useState<Regime>((valores.regime as Regime) ?? "Simples");

  return (
    <form action={action} className="card">
      <label style={{ maxWidth: 280, marginBottom: 16 }}>
        Regime tributário da empresa
        <select name="regime" value={regime} onChange={(e) => setRegime(e.target.value as Regime)}>
          <option value="Simples">Simples Nacional</option>
          <option value="Presumido">Lucro Presumido</option>
          <option value="Real">Lucro Real</option>
        </select>
      </label>

      <p className="ajuda">Informe em pontos percentuais: 6,00 significa 6%.</p>

      {regime === "Simples" ? (
        <>
          <h3>Simples Nacional</h3>
          <p className="mini">
            O DAS já inclui IRPJ, CSLL, PIS, COFINS e ISS. Informe a alíquota efetiva da faixa da empresa.
          </p>
          <div className="grade">
            <label>
              DAS – alíquota efetiva (%)
              <input name="das" inputMode="decimal" defaultValue={fmt(valores.das)} required />
            </label>
          </div>
        </>
      ) : (
        <>
          <h3>Tributos sobre o faturamento</h3>
          <Campos lista={SOBRE_FATURAMENTO} valores={valores} regime={regime} />

          <h3 style={{ marginTop: 18 }}>Tributos sobre o lucro</h3>
          <p className="mini">
            {regime === "Presumido"
              ? "No Presumido, IRPJ e CSLL incidem sobre a receita × presunção. Ex.: 15% × 32% = 4,80% da receita."
              : "No Real, IRPJ e CSLL incidem sobre o lucro do contrato. Se o contrato der prejuízo, não há imposto."}
          </p>
          {regime === "Presumido" && <Campos lista={PRESUNCAO} valores={valores} regime={regime} />}
          <div style={{ marginTop: 12 }}>
            <Campos lista={SOBRE_LUCRO} valores={valores} regime={regime} />
          </div>
        </>
      )}

      <h3 style={{ marginTop: 18 }}>Encargos sobre a folha</h3>
      <div className="grade">
        <label>
          Encargos sociais (%)
          <input name="encargos_sociais" inputMode="decimal" defaultValue={fmt(valores.encargos_sociais)} required />
          <span className="mini">INSS patronal, RAT e terceiros, sem o FGTS. No Simples (Anexo III), costuma ser 0.</span>
        </label>
      </div>

      {/* campos de outros regimes vão zerados para não somar tributo indevido */}
      {regime === "Simples" &&
        ["pis", "cofins", "iss", "cprb", "irpj", "csll", "presuncao_irpj", "presuncao_csll", "adicional_irpj"].map((n) => (
          <input key={n} type="hidden" name={n} value="0" />
        ))}
      {regime !== "Simples" && <input type="hidden" name="das" value="0" />}
      {regime === "Real" && ["presuncao_irpj", "presuncao_csll"].map((n) => <input key={n} type="hidden" name={n} value="0" />)}

      <div style={{ marginTop: 16 }}><button>Salvar configuração</button></div>
    </form>
  );
}
