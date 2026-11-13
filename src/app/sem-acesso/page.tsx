import { sair } from "../login/actions";

export default function SemAcesso() {
  return (
    <div className="centro-login">
      <div className="card">
        <h1>Módulo indisponível</h1>
        <p className="subtitulo">
          A assinatura da Gestão de Contratos venceu ou o seu usuário não tem este módulo liberado.
          Fale com o responsável pela conta da sua empresa.
        </p>
        <form action={sair}><button className="sec">Sair</button></form>
      </div>
    </div>
  );
}
