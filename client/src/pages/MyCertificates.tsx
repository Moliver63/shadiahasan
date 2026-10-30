/**
 * Meus certificados: um por aula concluída e um geral por Programa.
 * Dados: trpc.certificados.meus (server/certificados.ts). O PDF sai de
 * /api/certificados/<numero>.pdf, gerado na hora com o nome do perfil.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Award, Copy, Download, ExternalLink, Loader2, UserRound } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import PublicHeader from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

const dataCurta = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

type Item = { id: number; tipo: "aula" | "programa"; titulo: string; subtitulo: string | null; numero: string; emitidoEm: Date | string };

async function baixarPdf(numero: string) {
  try {
    const r = await fetch(`/api/certificados/${numero}.pdf`, { credentials: "include" });
    if (!r.ok) {
      toast.error((await r.text()) || "Não foi possível baixar o certificado agora.");
      return;
    }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificado-${numero}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {
    toast.error("Não foi possível baixar o certificado agora. Confira sua conexão.");
  }
}

function copiarLink(numero: string) {
  const link = `${window.location.origin}/certificado/${numero}`;
  navigator.clipboard.writeText(link).then(
    () => toast.success("Link de verificação copiado"),
    () => toast.error("Não foi possível copiar. O link é " + link),
  );
}

function Cartao({ c }: { c: Item }) {
  const [baixando, setBaixando] = useState(false);
  const geral = c.tipo === "programa";
  return (
    <Card className={geral ? "border-primary/40 bg-primary/[0.03]" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${geral ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
            <Award className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              {geral ? "Certificado geral do Programa" : "Certificado de aula"}
            </CardDescription>
            <CardTitle className="mt-0.5 text-lg leading-snug">{c.titulo}</CardTitle>
            {!geral && c.subtitulo && <p className="mt-0.5 text-sm text-muted-foreground">Programa: {c.subtitulo}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Emitido em {dataCurta(c.emitidoEm)} · <span className="font-mono">{c.numero}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={baixando} onClick={async () => { setBaixando(true); await baixarPdf(c.numero); setBaixando(false); }}>
            {baixando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Baixar PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => copiarLink(c.numero)}>
            <Copy className="mr-2 h-4 w-4" /> Copiar link
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/certificado/${c.numero}`}><ExternalLink className="mr-2 h-4 w-4" /> Ver verificação</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyCertificates() {
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.certificados.meus.useQuery(undefined, { enabled: isAuthenticated });
  const sincronizar = trpc.certificados.sincronizar.useMutation({
    onSuccess: (r) => { if (r.novos > 0) utils.certificados.meus.invalidate(); },
  });

  // Quem concluiu aulas antes de os certificados existirem recebe os atrasados ao abrir a página
  const sincronizou = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !sincronizou.current) {
      sincronizou.current = true;
      sincronizar.mutate();
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const lista = (data?.certificados ?? []) as Item[];
  const gerais = lista.filter((c) => c.tipo === "programa");
  const aulas = lista.filter((c) => c.tipo === "aula");

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader
        items={[
          { label: "Minha Área", href: "/minha-area" },
          { label: "Catálogo", href: "/courses", match: "prefix" },
          { label: "Certificados", href: "/certificates" },
        ]}
        className="bg-card"
      />

      <main className="container max-w-5xl space-y-8 py-8 md:py-12">
        <header>
          <h1 className="text-3xl font-bold sm:text-4xl">Meus certificados</h1>
          <p className="mt-1 text-lg text-muted-foreground">
            Você ganha um certificado a cada aula concluída e um certificado geral ao concluir todas as aulas de um Programa.
          </p>
        </header>

        {data?.semNome && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex flex-col gap-3 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Seu perfil ainda não tem nome. Ele é o nome que sai impresso no certificado.
              </span>
              <Button asChild size="sm" variant="outline"><Link href="/profile">Completar meu perfil</Link></Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">{[1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>
        ) : lista.length === 0 ? (
          <Card className="py-10 text-center">
            <CardContent>
              <Award className="mx-auto mb-4 h-14 w-14 text-muted-foreground/50" aria-hidden />
              <h2 className="text-xl font-semibold">Seu primeiro certificado está a uma aula de distância</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Assista uma aula até o fim e o certificado dela aparece aqui, pronto para baixar em PDF.
              </p>
              <Button asChild className="mt-6"><Link href="/minha-area">Ir para Minha Área</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {gerais.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Certificados gerais</h2>
                <div className="grid gap-4 md:grid-cols-2">{gerais.map((c) => <Cartao key={c.id} c={c} />)}</div>
              </section>
            )}
            {aulas.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Certificados por aula <span className="text-base font-normal text-muted-foreground">({aulas.length})</span></h2>
                <div className="grid gap-4 md:grid-cols-2">{aulas.map((c) => <Cartao key={c.id} c={c} />)}</div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
