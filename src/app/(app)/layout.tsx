import Link from "next/link";
import { exigirModuloContratos } from "@/lib/sessao";
import { sair } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { empresa } = await exigirModuloContratos();
  return (
    <>
      <header className="topo">
        <div className="topo-inner">
          <span className="marca">Nexus · Contratos</span>
          <nav>
            <Link href="/contratos">Contratos</Link>
            <Link href="/demonstracao">Demonstração financeira</Link>
            <Link href="/config-tributaria">Configuração tributária</Link>
          </nav>
          <div className="empresa">
            <span>{empresa.razao_social}</span>
            <form action={sair}><button className="peq">Sair</button></form>
          </div>
        </div>
      </header>
      <main className="pagina">{children}</main>
    </>
  );
}
