"use client";

/** Botão de envio que pede confirmação antes (excluir etc.). */
export function BotaoConfirmar({
  mensagem,
  children,
  className = "perigo peq",
}: {
  mensagem: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(mensagem)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
