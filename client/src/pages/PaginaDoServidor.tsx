import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Rotas servidas pelo servidor (/diario e /presentes/diario), fora do app React.
 * Este componente só aparece quando um service worker antigo devolveu o index.html
 * no lugar da página real. Tira o service worker do caminho e recarrega uma vez;
 * o novo é registrado de novo na próxima página do site.
 */
export default function PaginaDoServidor() {
  useEffect(() => {
    const chave = "recarregou:" + window.location.pathname;
    let jaTentou = false;
    try { jaTentou = sessionStorage.getItem(chave) === "1"; sessionStorage.setItem(chave, "1"); } catch { /* sem sessionStorage */ }
    if (jaTentou) return;
    const recarregar = () => window.location.reload();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .finally(recarregar);
    } else recarregar();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-muted-foreground">Abrindo seu diário…</p>
      <a href={window.location.pathname} className="text-sm underline underline-offset-4">Se não abrir, toque aqui</a>
    </div>
  );
}
