import Link from "next/link";
import { exigirModuloContratos } from "@/lib/sessao";
import { carregarContratos, STATUS, type Orgao } from "@/lib/dados";
import { data, diasRestantes, moeda } from "@/lib/formato";
import { criarContrato, criarOrgao } from "../actions";
import { SeloStatus, SeloDias } from "@/components/Selos";

export default async function Central({
  searchParams,
}: {
  searchParams: Promise<{ orgao?: string; status?: string; erro?: string }>;
}) {
  const { orgao, status, erro } = await searchParams;
  const { supabase } = await exigirModuloContratos();
  const [{ contratos, calc }, { data: orgaosRaw }] = await Promise.all([
    carregarContratos(supabase),
    supabase.from("orgaos").select("id, nome, cnpj, endereco").order("nome"),
  ]);
  const orgaos = (orgaosRaw ?? []) as Orgao[];

  const filtrados = contratos.filter(
    (c) => (!orgao || c.orgao_id === orgao) && (!status || c.status === status),
  );
  const receita = filtrados.reduce((s, c) => s + (calc.get(c.id)?.receita ?? 0), 0);
  const resultado = filtrados.reduce((s, c) => s + (calc.get(c.id)?.resultado ?? 0), 0);
  const vencendo = filtrados.filter((c) => {
    const d = diasRestantes(c.vigencia_fim);
    return d !== null && d >= 0 && d <= 90;
  }).length;

  return (
    <>
      <div className="entre" style={{ marginBottom: 16 }}>
        <div>
          <h1>Contratos</h1>
          <p className="subtitulo" style={{ margin: 0 }}>Receita, resultado e vigência de cada contrato.</p>
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="kpis">
        <div className="kpi"><div className="rotulo">Contratos</div><div className="valor">{filtrados.length}</div></div>
        <div className="kpi"><div className="rotulo">Receita mensal</div><div className="valor">{moeda(receita)}</div></div>
        <div className="kpi"><div className="rotulo">Resultado mensal</div><div className={`valor ${resultado < 0 ? "neg" : "pos"}`}>{moeda(resultado)}</div></div>
        <div className="kpi"><div className="rotulo">Vencendo em 90 dias</div><div className="valor">{vencendo}</div></div>
      </div>

      <div className="grade-2">
        <details className="painel">
          <summary>+ Novo órgão</summary>
          <form action={criarOrgao} className="grade">
            <label>Nome<input name="nome" required /></label>
            <label>CNPJ<input name="cnpj" /></label>
            <label style={{ gridColumn: "1 / -1" }}>Endereço<input name="endereco" /></label>
            <div><button>Salvar órgão</button></div>
          </form>
        </details>

        <details className="painel">
          <summary>+ Novo contrato</summary>
          {orgaos.length === 0 ? (
            <p className="ajuda">Cadastre um órgão primeiro.</p>
          ) : (
            <form action={criarContrato} className="grade">
              <label>Órgão
                <select name="orgao_id" required>
                  {orgaos.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </label>
              <label>Número<input name="numero" required /></label>
              <label style={{ gridColumn: "1 / -1" }}>Objeto<input name="objeto" /></label>
              <label>Início<input name="vigencia_inicio" type="date" /></label>
              <label>Fim<input name="vigencia_fim" type="date" /></label>
              <label>Status
                <select name="status">{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
              </label>
              <label>Provisões
                <select name="modo_provisao">
                  <option>Individual</option>
                  <option>Percentual único</option>
                </select>
              </label>
              <label>% provisão única<input name="perc_provisao_unica" inputMode="decimal" placeholder="0,00" /></label>
              <div><button>Criar contrato</button></div>
            </form>
          )}
        </details>
      </div>

      <div className="card">
        <form className="linha" style={{ marginBottom: 12 }}>
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
          {(orgao || status) && <Link className="botao sec" href="/contratos">Limpar</Link>}
        </form>

        {filtrados.length === 0 ? (
          <p className="mini">Nenhum contrato {orgao || status ? "com esses filtros" : "cadastrado ainda"}.</p>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Órgão</th><th>Nº</th><th>Status</th>
                  <th className="num">Receita mensal</th><th className="num">Resultado</th>
                  <th>Vigência</th><th>Dias restantes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const d = calc.get(c.id)!;
                  return (
                    <tr key={c.id}>
                      <td>{c.orgaos?.nome}</td>
                      <td>{c.numero}</td>
                      <td><SeloStatus status={c.status} /></td>
                      <td className="num">{moeda(d.receita)}</td>
                      <td className={`num ${d.resultado < 0 ? "neg" : "pos"}`}>{moeda(d.resultado)}</td>
                      <td>{data(c.vigencia_inicio)} a {data(c.vigencia_fim)}</td>
                      <td><SeloDias fim={c.vigencia_fim} /></td>
                      <td><Link className="botao sec peq" href={`/contratos/${c.id}`}>Abrir</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
