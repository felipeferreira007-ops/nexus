const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const moeda = (v: number | null | undefined) => brl.format(Number(v) || 0);
export const pct = (v: number | null | undefined) => `${num.format(Number(v) || 0)}%`;
export const numero = (v: number | null | undefined) => num.format(Number(v) || 0);

export function data(iso: string | null | undefined) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function diasRestantes(fim: string | null | undefined): number | null {
  if (!fim) return null;
  const hoje = new Date(new Date().toISOString().slice(0, 10));
  return Math.round((new Date(fim).getTime() - hoje.getTime()) / 86_400_000);
}

/** Lê número de formulário aceitando vírgula decimal (1.234,56 ou 1234.56). */
export function lerNumero(v: FormDataEntryValue | null): number {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export const lerTexto = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
