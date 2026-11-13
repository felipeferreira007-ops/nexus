import { exigirModuloContratos } from "@/lib/sessao";
import { carregarConfig } from "@/lib/dados";
import { CONFIG_ZERADA } from "@/domain/calculo";
import { salvarConfigTributaria } from "../actions";
import { ConfigTributariaForm } from "@/components/ConfigTributariaForm";

const NOME_REGIME = { Simples: "Simples Nacional", Presumido: "Lucro Presumido", Real: "Lucro Real" };

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
        Regime atual: <strong>{atual ? NOME_REGIME[atual.regime] : "não configurado (alíquotas zeradas)"}</strong>.
        Vale para todos os contratos da empresa.
      </p>
      {erro && <p className="erro">{erro}</p>}
      {salvo && <p className="ajuda">Configuração salva. Os contratos já foram recalculados.</p>}
      <ConfigTributariaForm action={salvarConfigTributaria} valores={cfg} />
    </>
  );
}
