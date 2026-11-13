"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

function credenciais(form: FormData) {
  return { email: String(form.get("email") ?? "").trim(), password: String(form.get("senha") ?? "") };
}

export async function entrar(form: FormData) {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword(credenciais(form));
  if (error) redirect(`/login?erro=${encodeURIComponent("E-mail ou senha inválidos.")}`);
  redirect("/contratos");
}

export async function cadastrar(form: FormData) {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp(credenciais(form));
  if (error) redirect(`/login?erro=${encodeURIComponent(error.message)}`);
  if (!data.session) {
    redirect(`/login?aviso=${encodeURIComponent("Conta criada. Confirme o e-mail e depois entre.")}`);
  }
  redirect("/onboarding");
}

export async function sair() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}
