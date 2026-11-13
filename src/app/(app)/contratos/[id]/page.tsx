import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirModuloContratos } from "@/lib/sessao";
import { carregarContratos, STATUS, type Orgao } from "@/lib/dados";
import { data, moeda, numero, pct } from "@/lib/formato";
import { custoBeneficio, FATOR_REGIME } from "@/domain/calculo";
import {
  editarContrato, excluirBeneficio, excluirContrato, excluirCusto, excluirPosto,
  salvarBeneficio, salvarCusto, salvarPosto,
} from "../../actions";
import { PostoForm } from "@/components/PostoForm";
import { BotaoConfirmar } from "@/components/BotaoConfirmar";
import { SeloDias, SeloStatus } from "@/components/Selos";

const TIPOS_BENEFICIO = ["Vale-alimentação", "Vale-transporte", "Plano de saúde", "Seguro de vida", "Cesta básica", "Outro"];
const TIPOS_CUSTO = ["Uniformes", "Materiais", "Equipamentos", "EPIs", "ASO", "Outros"];

export default async function ContratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { supabase } = await exigirModuloContratos();
  const [{ contratos, postos, beneficios, custos, config, calc }, { data: orgaosRaw }] = await Promise.all([
    carregarContratos(supabase, id),
    supabase.from("orgaos").select("id, nome, cnpj, endereco").order("nome"),
  ]);
  const contrato = contratos[0];
  if (!contrato) notFound();
  const orgaos = (orgaosRaw ?? []) as Orgao[];
  const d = calc.get(id)!;
  const regime = config?.regime ?? "Simples";

  return (
    <>
      <p className="mini"><Link href="/contratos">← Contratos</Link></p>

      <div className="card">
        <div className="entre">
          <div>
            <h1>{contrato.orgaos?.nome} · Contrato {contrato.numero}</h1>
            <p className="mini" style={{ margin: 0 }}>{contrato.objeto ?? "Sem objeto informado"}</p>
          </div>
          <div className="linha">
            <SeloStatus status={contrato.status} />
            <SeloDias fim={contrato.vigencia_fim} />
          </div>
        </div>
        <p className="mini">
          Vigência: {data(contrato.vigencia_inicio)} a {data(contrato.vigencia_fim)} · Provisões: {contrato.modo_provisao}
          {contrato.modo_provisao === "Percentual único" && ` (${pct(contrato.perc_provisao_unica)})`}
        </p>

        <details className="painel">
          <summary>Editar contrato</summary>
          <form action={editarContrato} className="grade">
            <input type="hidden" name="id" value={contrato.id} />
            <label>Órgão
              <select name="orgao_id" defaultValue={contrato.orgao_id}>
                {orgaos.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </label>
            <label>Renomear órgão (todos os contratos)<input name="renomear_orgao" placeholder={contrato.orgaos?.nome} /></label>
            <label>Número<input name="numero" defaultValue={contrato.numero} required /></label>
            <label style={{ gridColumn: "1 / -1" }}>Objeto<input name="objeto" defaultValue={contrato.objeto ?? ""} /></label>
            <label>Início<input type="date" name="vigencia_inicio" defaultValue={contrato.vigencia_inicio ?? ""} /></label>
            <label>Fim<input type="date" name="vigencia_fim" defaultValue={contrato.vigencia_fim ?? ""} /></label>
            <label>Status
              <select name="status" defaultValue={contrato.status}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
            <label>Provisões
              <select name="modo_provisao" defaultValue={contrato.modo_provisao}>
                <option>Individual</option><option>Percentual único</option>
              </select>
            </label>
            <label>% provisão única
              <input name="perc_provisao_unica" inputMode="decimal" defaultValue={String(contrato.perc_provisao_unica).replace(".", ",")} />
            </label>
            <div><button>Salvar alterações</button></div>
          </form>
          <form action={excluirContrato} style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={contrato.id} />
            <BotaoConfirmar mensagem="Excluir este contrato com todos os postos, benefícios e custos?">Excluir contrato</BotaoConfirmar>
          </form>
        </details>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="kpis">
        <div className="kpi"><div className="rotulo">Receita mensal</div><div className="valor">{moeda(d.receita)}</div></div>
        <div className="kpi"><div className="rotulo">Custo total</div><div className="valor">{moeda(d.custoTotal)}</div></div>
        <div className="kpi"><div className="rotulo">(−) Materiais</div><div className="valor">{moeda(d.materiais)}</div></div>
        <div className="kpi"><div className="rotulo">Resultado líquido</div><div className={`valor ${d.resultado < 0 ? "neg" : "pos"}`}>{moeda(d.resultado)}</div></div>
        <div className="kpi"><div className="rotulo">Margem</div><div className={`valor ${d.margem < 0 ? "neg" : "pos"}`}>{pct(d.margem)}</div></div>
      </div>

      {/* ---------- Postos ---------- */}
      <div className="card">
        <h2>Postos de trabalho</h2>
        <details className="painel">
          <summary>+ Adicionar posto</summary>
          <PostoForm action={salvarPosto} contratoId={contrato.id} />
        </details>

        {postos.length === 0 && <p className="mini">Nenhum posto cadastrado.</p>}

        {postos.map((p) => {
          const calcP = d.porPosto.find((x) => x.id === p.id)!;
          const bens = beneficios.filter((b) => b.posto_id === p.id);
          const fator = FATOR_REGIME[p.regime];
          const fixos = p.salario_base + p.insalubridade + p.periculosidade + p.outros_adicionais;
          const variaveis = p.adicional_noturno + p.dsr_noturno + p.intrajornada;
          return (
            <div className="posto" key={p.id}>
              <div className="posto-cab">
                <div>
                  <h3>{p.funcao} <span className="selo neutro">{p.regime}</span></h3>
                  <div className="mini">
                    {numero(p.quantidade_postos)} previsto(s) · {numero(p.quantidade_executada)} executado(s) ·{" "}
                    {numero(calcP.funcionarios)} funcionário(s) equivalente(s)
                    {p.convencao && ` · CCT: ${p.convencao}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>Receita <strong>{moeda(calcP.receita)}</strong></div>
                  <div className="mini">Folha {moeda(calcP.folha)} · Benefícios {moeda(calcP.beneficios)}</div>
                </div>
              </div>

              <details className="painel" style={{ marginTop: 10 }}>
                <summary>Cálculo do custo e da receita</summary>
                <p className="mini">
                  Folha = ({moeda(p.salario_base)} + {moeda(p.insalubridade)} + {moeda(p.periculosidade)} + {moeda(p.outros_adicionais)})
                  {" "}× {numero(p.quantidade_executada)} × fator {fator} + ({moeda(p.adicional_noturno)} + {moeda(p.dsr_noturno)} + {moeda(p.intrajornada)})
                  {" "}× {numero(p.quantidade_executada)} = {moeda(fixos * p.quantidade_executada * fator)} + {moeda(variaveis * p.quantidade_executada)} = <strong>{moeda(calcP.folha)}</strong>
                </p>
                <p className="mini">
                  Receita = {moeda(p.valor_unitario_posto)} × {numero(p.quantidade_postos)} = <strong>{moeda(calcP.receita)}</strong>
                </p>
              </details>

              <details className="painel">
                <summary>Benefícios ({bens.length})</summary>
                {bens.length > 0 && (
                  <div className="tabela-wrap">
                    <table>
                      <thead><tr><th>Tipo</th><th>Periodicidade</th><th className="num">Valor</th><th className="num">Dias</th><th className="num">Descontos</th><th className="num">Total mensal</th><th></th></tr></thead>
                      <tbody>
                        {bens.map((b) => (
                          <tr key={b.id}>
                            <td>{b.tipo}{b.descricao && <div className="mini">{b.descricao}</div>}</td>
                            <td>{b.periodicidade}</td>
                            <td className="num">{moeda(b.valor_unitario)}</td>
                            <td className="num">{b.periodicidade === "Mensal" ? "—" : numero(b.dias_mes)}</td>
                            <td className="num">{moeda(b.desconto_fixo)} + {pct(b.desconto_percentual)}</td>
                            <td className="num">{moeda(custoBeneficio(b, p))}</td>
                            <td>
                              <form action={excluirBeneficio}>
                                <input type="hidden" name="id" value={b.id} />
                                <input type="hidden" name="contrato_id" value={contrato.id} />
                                <BotaoConfirmar mensagem="Excluir este benefício?">Excluir</BotaoConfirmar>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <form action={salvarBeneficio} className="grade" style={{ marginTop: 10 }}>
                  <input type="hidden" name="posto_id" value={p.id} />
                  <input type="hidden" name="contrato_id" value={contrato.id} />
                  <label>Tipo<select name="tipo">{TIPOS_BENEFICIO.map((t) => <option key={t}>{t}</option>)}</select></label>
                  <label>Descrição (obrigatória em Outro)<input name="descricao" /></label>
                  <label>Periodicidade<select name="periodicidade"><option>Diário</option><option>Mensal</option></select></label>
                  <label>Valor unitário<input name="valor_unitario" inputMode="decimal" placeholder="0,00" /></label>
                  <label>Dias no mês<input name="dias_mes" inputMode="decimal" defaultValue="22" /></label>
                  <label>Desconto fixo por empregado<input name="desconto_fixo" inputMode="decimal" placeholder="0,00" /></label>
                  <label>Desconto % sobre salário<input name="desconto_percentual" inputMode="decimal" placeholder="ex.: 6" /></label>
                  <div><button className="sec">Adicionar benefício</button></div>
                </form>
              </details>

              <div className="linha">
                <details className="painel" style={{ flex: 1 }}>
                  <summary>Editar posto</summary>
                  <PostoForm action={salvarPosto} contratoId={contrato.id} valores={p as unknown as Record<string, string | number | null>} rotuloBotao="Salvar alterações" />
                </details>
                <form action={excluirPosto}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="contrato_id" value={contrato.id} />
                  <BotaoConfirmar mensagem="Excluir este posto e todos os benefícios dele?">Excluir posto</BotaoConfirmar>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- Custos operacionais ---------- */}
      <div className="card">
        <h2>Custos operacionais</h2>
        {custos.length > 0 && (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Tipo</th><th>Descrição</th><th className="num">Valor mensal</th><th></th></tr></thead>
              <tbody>
                {custos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.tipo}</td>
                    <td>{c.descricao ?? "—"}</td>
                    <td className="num">{moeda(c.valor_mensal)}</td>
                    <td>
                      <form action={excluirCusto}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="contrato_id" value={contrato.id} />
                        <BotaoConfirmar mensagem="Excluir este custo?">Excluir</BotaoConfirmar>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form action={salvarCusto} className="linha" style={{ marginTop: 12 }}>
          <input type="hidden" name="contrato_id" value={contrato.id} />
          <label>Tipo<select name="tipo">{TIPOS_CUSTO.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label style={{ flex: 1 }}>Descrição<input name="descricao" /></label>
          <label>Valor mensal<input name="valor_mensal" inputMode="decimal" placeholder="0,00" /></label>
          <button className="sec">Adicionar custo</button>
        </form>
      </div>

      {/* ---------- Demonstração ---------- */}
      <div className="card">
        <div className="entre"><h2>Demonstração do resultado mensal</h2><span className="mini">Regime tributário: {regime}</span></div>
        {!config && (
          <p className="ajuda">
            Sem configuração tributária, tributos e encargos valem zero. <Link href="/config-tributaria">Configurar agora</Link>.
          </p>
        )}
        {config && regime === "Simples" && !(config.das > 0) && (
          <p className="erro">
            Regime Simples com DAS zerado: nenhum tributo está sendo descontado. <Link href="/config-tributaria">Revisar configuração</Link>.
          </p>
        )}
        {config && regime === "Presumido" && (!(config.presuncao_irpj > 0) || !(config.presuncao_csll > 0)) && (
          <p className="erro">
            Lucro Presumido sem percentual de presunção: IRPJ e CSLL estão zerados. <Link href="/config-tributaria">Revisar configuração</Link>.
          </p>
        )}
        <table className="dre">
          <tbody>
            <tr><td>Receita</td><td className="num">{moeda(d.receita)}</td></tr>
            <tr><td>(−) Folha</td><td className="num">{moeda(d.folha)}</td></tr>
            <tr><td>(−) FGTS (8%)</td><td className="num">{moeda(d.fgts)}</td></tr>
            <tr><td>(−) Encargos sociais ({pct(config?.encargos_sociais)})</td><td className="num">{moeda(d.encargos)}</td></tr>
            <tr><td>(−) Benefícios</td><td className="num">{moeda(d.beneficios)}</td></tr>
            <tr><td>(−) Provisões</td><td className="num">{moeda(d.provisoes)}</td></tr>
            {d.provisoesDetalhe && (
              <>
                <tr className="sub"><td>13º salário (folha ÷ 12)</td><td className="num">{moeda(d.provisoesDetalhe.decimoTerceiro)}</td></tr>
                <tr className="sub"><td>Férias (folha ÷ 12)</td><td className="num">{moeda(d.provisoesDetalhe.ferias)}</td></tr>
                <tr className="sub"><td>1/3 de férias (folha ÷ 36)</td><td className="num">{moeda(d.provisoesDetalhe.tercoFerias)}</td></tr>
                <tr className="sub"><td>FGTS sobre as verbas</td><td className="num">{moeda(d.provisoesDetalhe.fgtsSobreVerbas)}</td></tr>
                <tr className="sub"><td>Multa de 40% do FGTS</td><td className="num">{moeda(d.provisoesDetalhe.multaFgts)}</td></tr>
              </>
            )}
            <tr><td>(−) Custos operacionais</td><td className="num">{moeda(d.custosOperacionais)}</td></tr>
            <tr><td>(−) Tributos sobre faturamento</td><td className="num">{moeda(d.tributos)}</td></tr>
            <tr className="total"><td>(=) Lucro antes do IR</td><td className={`num ${d.lucroAntesIR < 0 ? "neg" : ""}`}>{moeda(d.lucroAntesIR)}</td></tr>
            <tr><td>(−) IRPJ / CSLL</td><td className="num">{moeda(d.impostosLucro)}</td></tr>
            <tr className="total"><td>(=) Resultado líquido</td><td className={`num ${d.resultado < 0 ? "neg" : "pos"}`}>{moeda(d.resultado)}</td></tr>
            <tr><td>Margem</td><td className="num">{pct(d.margem)}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
