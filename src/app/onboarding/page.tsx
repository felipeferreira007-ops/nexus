import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { lerTexto } from "@/lib/formato";

async function criarEmpresa(form: FormData) {
  "use server";
  const sb = await supabaseServer();
  const { error } = await sb.rpc("criar_empresa", {
    p_razao_social: lerTexto(form.get("razao_social")),
    p_cnpj: lerTexto(form.get("cnpj")),
    p_endereco: lerTexto(form.get("endereco")),
  });
  if (error) redirect(`/onboarding?erro=${encodeURIComponent(error.message)}`);
  redirect("/contratos");
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await sb.from("perfis").select("empresa_id").eq("user_id", user.id).maybeSingle();
  if (perfil) redirect("/contratos");

  return (
    <div className="centro-login">
      <div className="card">
        <h1>Sua empresa</h1>
        <p className="subtitulo">Cadastre a empresa para começar. Você ganha 30 dias de teste.</p>
        {erro && <p className="erro">{erro}</p>}
        <form action={criarEmpresa} style={{ display: "grid", gap: 12 }}>
          <label>Razão social<input name="razao_social" required /></label>
          <label>CNPJ<input name="cnpj" required /></label>
          <label>Endereço<input name="endereco" /></label>
          <button>Começar</button>
        </form>
      </div>
    </div>
  );
}
