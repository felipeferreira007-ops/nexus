import { exigirModuloContratos } from "@/lib/sessao";
import { carregarConfig } from "@/lib/dados";
import { CONFIG_ZERADA, LIMITE_ADICIONAL_IRPJ } from "@/domain/calculo";
import { moeda } from "@/lib/formato";
import { salvarConfigTributaria } from "../actions";

const CAMPOS: Array<[string, string, string]> = [
  ["das", "DAS (Simples)", "Alíquota efetiva do Simples Nacional."],
  ["pis", "PIS", ""],
  ["cofins", "COFINS", ""],
  ["iss", "ISS", ""],
  ["cprb", "CPRB", "Desoneração da folha, se houver."],
  ["irpj", "IRPJ", ""],
  ["csll", "CSLL", ""],
  ["presuncao_irpj", "Presunção IRPJ", "Lucro Presumido (ex.: 32)."],
  ["presuncao_csll", "Presunção CSLL", "Lucro Presumido (ex.: 32)."],
  ["adicional_irpj", "Adicional de IRPJ", `Sobre o que passar de ${moeda(LIMITE_ADICIONAL_IRPJ)} por mês.`],
  ["encargos_sociais", "Encargos sociais sobre a folha", "INSS patronal, RAT, terceiros etc., sem o FGTS."],
];

export default async function ConfigTributaria({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; salvo?: string }>;
}) {
  const { erro, salvo } = await searchParams;
  const { supabase } = await exigirModuloContratos();
  const atual = await carregarConfig(supabase);
  const cfg = (atual ?? CONFIG_ZERADA) as unknown as Record<string, number | string>;

  return (
    <>
      <h1>Configuração tributária</h1>
      <p className="subtitulo">
        Regime atual: <strong>{atual ? atual.regime : "não configurado (alíquotas zeradas)"}</strong>. Vale para todos os contratos da empresa.
      </p>
      {erro && <p className="erro">{erro}</p>}
      {salvo && <p className="ajuda">Configuração salva. Os contratos já foram recalculados.</p>}

      <form action={salvarConfigTributaria} className="card">
        <label style={{ maxWidth: 260, marginBottom: 16 }}>
          Regime
          <select name="regime" defaultValue={String(cfg.regime)}>
            <option>Simples</option>
            <option>Presumido</option>
            <option>Real</option>
          </select>
        </label>
        <p className="ajuda">
          Informe em pontos percentuais: 6,00 significa 6%. No Simples só o DAS entra nos tributos sobre o faturamento;
          nos demais regimes entram PIS, COFINS, ISS e CPRB.
        </p>
        <div className="grade">
          {CAMPOS.map(([nome, rotulo, dica]) => (
            <label key={nome} title={dica}>
              {rotulo} (%)
              <input name={nome} inputMode="decimal" defaultValue={String(cfg[nome] ?? 0).replace(".", ",")} />
              {dica && <span className="mini">{dica}</span>}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 16 }}><button>Salvar configuração</button></div>
      </form>
    </>
  );
}
