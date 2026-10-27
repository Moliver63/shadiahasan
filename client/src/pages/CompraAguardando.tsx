import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Copy, Loader2, QrCode, CreditCard, LogIn, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { lerCompra, limparCompra } from "@/lib/compraSemConta";
import { getLoginUrl } from "@/const";
import { trackPurchaseGA4 } from "@/components/Analytics";

/** Fora do componente: definida dentro, remontaria a cada consulta (4 s) e fecharia o QR aberto. */
function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "linear-gradient(135deg, #1d1410 0%, #2b1d16 55%, #3a2619 100%)" }}>
      <div className="mx-auto max-w-md rounded-3xl bg-[#fbf7f2] p-6 text-[#2b1d16] shadow-2xl sm:p-8">{children}</div>
    </div>
  );
}

/**
 * Depois de "Gerar Pix" na compra sem conta. Mostra o Pix (QR e copia e
 * cola), pergunta ao servidor a cada 4 s e, quando o pagamento cai, a aula
 * abre. O servidor confere no Asaas na hora; não depende do webhook.
 */
export default function CompraAguardando() {
  const [token] = useState(() => lerCompra());
  const [copiado, setCopiado] = useState(false);
  const status = trpc.trial.guestStatus.useQuery(
    { token: token || "" },
    {
      enabled: !!token,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchInterval: (q) => (q.state.data?.situacao === "pendente" ? 4000 : false),
    },
  );
  const dados = status.data;

  useEffect(() => {
    if (dados?.situacao === "paga" || dados?.situacao === "cancelada") limparCompra();
  }, [dados?.situacao]);

  // Compra no GA4, uma vez por cobrança (sobrevive a recarregar a página)
  useEffect(() => {
    const c = dados?.compra;
    if (dados?.situacao !== "paga" || !c) return;
    const chave = `shadia:ga4:purchase:${c.id}`;
    try { if (sessionStorage.getItem(chave)) return; sessionStorage.setItem(chave, "1"); } catch { /* segue: o GA4 deduplica pelo id */ }
    trackPurchaseGA4({ transactionId: c.id, value: c.valorCentavos / 100, contentId: `lesson:${dados.lessonId}` });
  }, [dados?.situacao, dados?.compra, dados?.lessonId]);

  const copiar = async () => {
    const codigo = dados?.pix?.copiaECola;
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
    } catch {
      // Navegadores antigos ou dentro de apps: seleciona num campo temporário
      const t = document.createElement("textarea");
      t.value = codigo;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch { /* a pessoa copia à mão */ }
      t.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 4000);
  };

  if (!token || status.error) {
    return (
      <Moldura>
        <AlertCircle className="mx-auto h-12 w-12 text-[#a8743c]" />
        <h1 className="mt-4 text-center font-serif text-2xl">Não encontramos sua compra neste aparelho</h1>
        <p className="mt-3 text-center text-base text-[#5c4a3d]">
          Se você já pagou, a aula está liberada no e-mail que você informou. Procure a mensagem "Sua aula está liberada".
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <a href={getLoginUrl()}><Button size="lg" className="h-12 w-full text-base">Entrar na minha conta</Button></a>
          <Link href="/#experimente-uma-aula"><Button size="lg" variant="outline" className="h-12 w-full text-base">Voltar para a oferta</Button></Link>
        </div>
      </Moldura>
    );
  }

  if (!dados) {
    return (
      <Moldura>
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#a8743c]" />
        <p className="mt-4 text-center text-base">Carregando seu Pix...</p>
      </Moldura>
    );
  }

  if (dados.situacao === "paga") {
    return (
      <Moldura>
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
        <h1 className="mt-4 text-center font-serif text-3xl">Pagamento confirmado!</h1>
        {dados.logado ? (
          <>
            <p className="mt-3 text-center text-lg">Sua aula está liberada.</p>
            {/* Recarrega a página inteira: a sessão acabou de ser criada */}
            <Button size="lg" className="mt-6 h-14 w-full text-lg" onClick={() => window.location.assign(`/lesson/${dados.lessonId}`)}>
              Assistir agora
            </Button>
            <p className="mt-5 text-center text-sm text-[#5c4a3d]">
              Enviamos para {dados.emailMascarado} um link para você criar sua senha e entrar de outros aparelhos.
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-center text-base">
              A aula foi liberada na conta do e-mail {dados.emailMascarado}. Entre nessa conta para assistir.
            </p>
            <a href={getLoginUrl()}>
              <Button size="lg" className="mt-6 h-14 w-full text-lg"><LogIn className="mr-2 h-5 w-5" /> Entrar e assistir</Button>
            </a>
            <p className="mt-4 text-center text-sm text-[#5c4a3d]">Não lembra a senha? Na tela de entrar, use "Esqueci minha senha".</p>
          </>
        )}
      </Moldura>
    );
  }

  if (dados.situacao === "cancelada") {
    return (
      <Moldura>
        <AlertCircle className="mx-auto h-12 w-12 text-[#a8743c]" />
        <h1 className="mt-4 text-center font-serif text-2xl">Este Pix não vale mais</h1>
        <p className="mt-3 text-center text-base text-[#5c4a3d]">Gere um novo para assistir à aula.</p>
        <Link href="/#experimente-uma-aula"><Button size="lg" className="mt-6 h-12 w-full text-base">Gerar novo Pix</Button></Link>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <p className="text-center text-[11px] font-medium uppercase tracking-[0.3em] text-[#a8743c]">Falta só o pagamento</p>
      <h1 className="mt-2 text-center font-serif text-3xl leading-tight">
        {dados.pix ? "Pague com Pix e a aula abre aqui" : "Pague e a aula abre aqui"}
      </h1>

      {dados.pix ? (
        <>
          <ol className="mt-5 space-y-2 text-base">
            <li><strong>1.</strong> Toque em <strong>Copiar código Pix</strong>.</li>
            <li><strong>2.</strong> Abra o app do seu banco e escolha <strong>Pix copia e cola</strong>.</li>
            <li><strong>3.</strong> Cole o código, confirme e volte para esta tela.</li>
          </ol>
          <Button size="lg" className="mt-5 h-14 w-full text-lg" onClick={copiar}>
            <Copy className="mr-2 h-5 w-5" /> {copiado ? "Código copiado!" : "Copiar código Pix"}
          </Button>
          {dados.pix.imagemBase64 && (
            <details className="mt-4 rounded-xl border border-[#e6d8c8] bg-white p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><QrCode className="h-4 w-4" /> Pagar pelo QR Code (de outro aparelho)</summary>
              <img src={`data:image/png;base64,${dados.pix.imagemBase64}`} alt="QR Code do Pix" className="mx-auto mt-3 h-56 w-56" />
            </details>
          )}
        </>
      ) : (
        <p className="mt-5 text-center text-base">Toque no botão abaixo para pagar com cartão ou boleto. Depois volte para esta tela.</p>
      )}

      {dados.invoiceUrl && (
        <a href={dados.invoiceUrl} className="mt-4 block">
          <Button size="lg" variant={dados.pix ? "outline" : "default"} className="h-12 w-full text-base">
            <CreditCard className="mr-2 h-5 w-5" /> {dados.pix ? "Prefiro cartão ou boleto" : "Pagar agora"}
          </Button>
        </a>
      )}

      <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#f3ebe1] px-4 py-3 text-sm text-[#5c4a3d]">
        <Loader2 className="h-4 w-4 animate-spin" /> Esperando o pagamento. Não precisa atualizar a página.
      </div>
      <p className="mt-4 text-center text-xs text-[#7a6656]">O acesso também vai para {dados.emailMascarado}.</p>
    </Moldura>
  );
}
