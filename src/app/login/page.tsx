import { entrar, cadastrar } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; aviso?: string }> }) {
  const { erro, aviso } = await searchParams;
  return (
    <div className="centro-login">
      <div className="card">
        <h1>Nexus</h1>
        <p className="subtitulo">Gestão de Contratos</p>
        {erro && <p className="erro">{erro}</p>}
        {aviso && <p className="ajuda">{aviso}</p>}
        <form style={{ display: "grid", gap: 12 }}>
          <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
          <label>Senha<input name="senha" type="password" required minLength={6} autoComplete="current-password" /></label>
          <div className="linha">
            <button formAction={entrar}>Entrar</button>
            <button formAction={cadastrar} className="sec">Criar conta</button>
          </div>
        </form>
      </div>
    </div>
  );
}
