"use client";

import { useState } from "react";
import type { Regime } from "@/domain/calculo";

type Valores = Partial<Record<string, string | number | null>>;

const AJUDA: Record<Regime, string> = {
  Normal: "Posto de 1 funcionário: salário e adicionais entram uma vez por posto.",
  "12x36":
    "O posto vale 2 funcionários: salário e adicionais são multiplicados por 2. Informe adicional noturno, DSR noturno e intrajornada já somados para o posto.",
  "24 horas":
    "O posto vale 4 funcionários (2 diurnos e 2 noturnos): salário e adicionais são multiplicados por 4. Informe os valores noturnos e de intrajornada de 1 funcionário; o sistema multiplica por 2.",
};

function Campo({ nome, rotulo, v, tipo = "decimal" }: { nome: string; rotulo: string; v?: Valores; tipo?: "decimal" | "texto" }) {
  const atual = v?.[nome];
  return (
    <label>
      {rotulo}
      <input
        name={nome}
        inputMode={tipo === "decimal" ? "decimal" : undefined}
        defaultValue={atual == null ? "" : String(atual).replace(".", tipo === "decimal" ? "," : ".")}
        placeholder={tipo === "decimal" ? "0,00" : undefined}
        required={nome === "funcao"}
      />
    </label>
  );
}

export function PostoForm({
  action,
  contratoId,
  valores,
  rotuloBotao = "Salvar posto",
}: {
  action: (form: FormData) => void | Promise<void>;
  contratoId: string;
  valores?: Valores;
  rotuloBotao?: string;
}) {
  const [regime, setRegime] = useState<Regime>((valores?.regime as Regime) ?? "Normal");

  return (
    <form action={action}>
      <input type="hidden" name="contrato_id" value={contratoId} />
      {valores?.id && <input type="hidden" name="id" value={String(valores.id)} />}
      <div className="grade">
        <Campo nome="funcao" rotulo="Função" v={valores} tipo="texto" />
        <Campo nome="convencao" rotulo="Convenção coletiva" v={valores} tipo="texto" />
        <label>
          Regime
          <select name="regime" value={regime} onChange={(e) => setRegime(e.target.value as Regime)}>
            <option>Normal</option>
            <option>12x36</option>
            <option>24 horas</option>
          </select>
        </label>
        <Campo nome="quantidade_postos" rotulo="Qtd. prevista (faturamento)" v={valores ?? { quantidade_postos: 1 }} />
        <Campo nome="quantidade_executada" rotulo="Qtd. executada (custo)" v={valores ?? { quantidade_executada: 1 }} />
        <Campo nome="valor_unitario_posto" rotulo="Valor mensal do posto" v={valores} />
        <Campo nome="salario_base" rotulo="Salário base" v={valores} />
        <Campo nome="insalubridade" rotulo="Insalubridade" v={valores} />
        <Campo nome="periculosidade" rotulo="Periculosidade" v={valores} />
        <Campo nome="outros_adicionais" rotulo="Outros adicionais" v={valores} />
        {regime === "24 horas" ? (
          <>
            <Campo nome="adicional_noturno_unit" rotulo="Adic. noturno (1 func.)" v={valores} />
            <Campo nome="dsr_noturno_unit" rotulo="DSR noturno (1 func.)" v={valores} />
            <Campo nome="intrajornada_diurna_unit" rotulo="Intrajornada diurna (1 func.)" v={valores} />
            <Campo nome="intrajornada_noturna_unit" rotulo="Intrajornada noturna (1 func.)" v={valores} />
          </>
        ) : (
          <>
            <Campo nome="adicional_noturno" rotulo="Adicional noturno" v={valores} />
            <Campo nome="dsr_noturno" rotulo="DSR noturno" v={valores} />
            <Campo nome="intrajornada" rotulo="Intrajornada" v={valores} />
          </>
        )}
      </div>
      <p className="ajuda">{AJUDA[regime]}</p>
      <button>{rotuloBotao}</button>
    </form>
  );
}
