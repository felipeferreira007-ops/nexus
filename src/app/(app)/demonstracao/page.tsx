import Link from "next/link";
import { exigirModuloContratos } from "@/lib/sessao";
import { carregarContratos, STATUS, type Orgao } from "@/lib/dados";
import { moeda, pct } from "@/lib/formato";
import { somarDemonstracoes } from "@/domain/calculo";

export default async function DemonstracaoFinanceira({
  searchParams,
}: {
  searchParams: Promise<{ orgao?: string; status?: string }>;
}) {
  const { orgao, status } = await searchParams;
  const { supabase } = await exigirModuloContratos();
  const [{ contratos, calc }, { data: orgaosRaw }] = await Promise.all([
    carregarContratos(supabase),
    supabase.from("orgaos").select("id, nome, cnpj, endereco").order("nome"),
  ]);
  const orgaos = (orgaosRaw ?? []) as Orgao[];
  const filtrados = contratos.filter((c) => (!orgao || c.orgao_id === orgao) && (!status || c.status === status));
  const total = somarDemonstracoes(filtrados.map((c) => calc.get(c.id)!));
  const ordenados = [...filtrados].sort((a, b) => calc.get(a.id)!.resultado - calc.get(b.id)!.resultado);

  return (
    <>
      <h1>Demonstração financeira</h1>
      <p className="subtitulo">Soma mensal dos contratos filtrados. Os que dão prejuízo aparecem primeiro.</p>

      <form className="card linha">
        <label>Órgão
          <select name="orgao" defaultValue={orgao ?? ""}>
            <option value="">Todos</option>
            {orgaos.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Todos</option>
            {STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <button className="sec">Filtrar</button>
        {(orgao || status) && <Link className="botao sec" href="/demonstracao">Limpar</Link>}
      </form>

      <div className="kpis">
        <div className="kpi"><div className="rotulo">Receita total</div><div className="valor">{moeda(total.receita)}</div></div>
        <div className="kpi"><div className="rotulo">Mão de obra</div><div className="valor">{moeda(total.custoMaoDeObra)}</div></div>
        <div className="kpi"><div className="rotulo">Insumos</div><div className="valor">{moeda(total.custosOperacionais)}</div></div>
        <div className="kpi"><div className="rotulo">Custos fiscais</div><div className="valor">{moeda(total.tributos)}</div></div>
        <div className="kpi"><div className="rotulo">Lucro antes dos impostos</div><div className="valor">{moeda(total.lucroAntesIR)}</div></div>
        <div className="kpi"><div className="rotulo">Impostos sobre o lucro</div><div className="valor">{moeda(total.impostosLucro)}</div></div>
        <div className="kpi"><div className="rotulo">Lucro líquido</div><div className={`valor ${total.resultado < 0 ? "neg" : "pos"}`}>{moeda(total.resultado)}</div></div>
        <div className="kpi"><div className="rotulo">Margem líquida</div><div className={`valor ${total.margem < 0 ? "neg" : "pos"}`}>{pct(total.margem)}</div></div>
      </div>

      <div className="card tabela-wrap">
        {ordenados.length === 0 ? (
          <p className="mini">Nenhum contrato para mostrar.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Contrato</th><th className="num">Receita</th><th className="num">Custo total</th><th className="num">Margem</th><th className="num">Resultado</th><th></th></tr>
            </thead>
            <tbody>
              {ordenados.map((c) => {
                const d = calc.get(c.id)!;
                return (
                  <tr key={c.id}>
                    <td>{c.orgaos?.nome}<div className="mini">Nº {c.numero} · {c.status}</div></td>
                    <td className="num">{moeda(d.receita)}</td>
                    <td className="num">{moeda(d.custoTotal)}</td>
                    <td className={`num ${d.margem < 0 ? "neg" : ""}`}>{pct(d.margem)}</td>
                    <td className={`num ${d.resultado < 0 ? "neg" : "pos"}`}>{moeda(d.resultado)}</td>
                    <td><Link className="botao sec peq" href={`/contratos/${c.id}`}>Abrir</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
