import { diasRestantes } from "@/lib/formato";

export function SeloStatus({ status }: { status: string }) {
  const tipo = status === "Vigente" ? "ok" : status === "Encerrado" ? "neutro" : "warn";
  return <span className={`selo ${tipo}`}>{status}</span>;
}

/** Dias até o fim da vigência, com cor pelos alertas de 90/60/30 dias. */
export function SeloDias({ fim }: { fim: string | null }) {
  const d = diasRestantes(fim);
  if (d === null) return <span className="mini">—</span>;
  if (d < 0) return <span className="selo neutro">Vencido há {-d} d</span>;
  const tipo = d <= 30 ? "bad" : d <= 90 ? "warn" : "ok";
  return <span className={`selo ${tipo}`}>{d} dias</span>;
}
