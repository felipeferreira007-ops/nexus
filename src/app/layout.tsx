import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus · Gestão de Contratos",
  description: "Viabilidade econômica dos contratos de terceirização com órgãos públicos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
