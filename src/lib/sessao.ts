import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export interface Empresa {
  id: string;
  razao_social: string;
  cnpj: string;
  endereco: string | null;
  acesso_contratos_ate: string | null;
}

/** Usuário logado com empresa e módulo liberado. Redireciona quando falta algo. */
export async function exigirModuloContratos() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("empresa_id, papel, modulos_liberados")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!perfil) redirect("/onboarding");

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, razao_social, cnpj, endereco, acesso_contratos_ate")
    .eq("id", perfil.empresa_id)
    .single<Empresa>();
  if (!empresa) redirect("/onboarding");

  const hoje = new Date().toISOString().slice(0, 10);
  const assinaturaAtiva = !!empresa.acesso_contratos_ate && empresa.acesso_contratos_ate >= hoje;
  const liberadoParaUsuario =
    perfil.papel === "principal" || (perfil.modulos_liberados ?? []).includes("contratos");
  if (!assinaturaAtiva || !liberadoParaUsuario) redirect("/sem-acesso");

  return { supabase, user, empresa, papel: perfil.papel as "principal" | "funcionario" };
}
