/**
 * Página pública de verificação de certificado (/certificado/:numero).
 * É para onde o QR code do PDF aponta. Mostra quem concluiu o quê e quando;
 * não mostra e-mail nem dados de conta.
 */
import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { Award, CheckCircle2, SearchX } from "lucide-react";
import SiteLogo from "@/components/SiteLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

const dataLonga = (d: Date | string) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" });

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-t py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default function CertificadoVerificar() {
  const { numero = "" } = useParams<{ numero: string }>();
  const { data, isLoading, error } = trpc.certificados.verificar.useQuery({ numero }, { retry: false });

  useEffect(() => {
    document.title = "Verificação de certificado | Shadia Hasan";
    // página de verificação não deve aparecer em buscadores
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex items-center justify-between py-3">
          <Link href="/"><SiteLogo className="h-16 cursor-pointer" /></Link>
          <Button asChild variant="ghost" size="sm"><Link href="/">Ir para o site</Link></Button>
        </div>
      </header>

      <main className="container max-w-xl py-10 md:py-16">
        {isLoading ? (
          <div className="space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-56 w-full" /></div>
        ) : error ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível consultar agora. Tente de novo em instantes.
          </CardContent></Card>
        ) : data?.valido ? (
          <>
            <div className="mb-6 flex items-center gap-3">
              <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <h1 className="text-2xl font-bold">Certificado autêntico</h1>
                <p className="text-sm text-muted-foreground">Este certificado foi emitido pela plataforma Shadia Hasan.</p>
              </div>
            </div>
            <Card>
              <CardContent className="pt-2">
                <dl>
                  <Linha rotulo="Aluno(a)">{data.nomeAluno ?? "Nome não informado"}</Linha>
                  <Linha rotulo={data.tipo === "programa" ? "Concluiu o Programa" : "Concluiu a aula"}>{data.titulo}</Linha>
                  {data.tipo === "aula" && data.subtitulo && <Linha rotulo="Programa">{data.subtitulo}</Linha>}
                  <Linha rotulo="Emitido em">{dataLonga(data.emitidoEm)}</Linha>
                  <Linha rotulo="Número"><span className="font-mono tracking-wide">{data.numero}</span></Linha>
                </dl>
              </CardContent>
            </Card>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Award className="h-4 w-4" aria-hidden />
              {data.tipo === "programa"
                ? "Certificado geral: o aluno concluiu todas as aulas do Programa."
                : "Certificado de aula: o aluno concluiu esta aula na plataforma."}
            </p>
          </>
        ) : (
          <div className="text-center">
            <SearchX className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
            <h1 className="text-2xl font-bold">Não encontramos este certificado</h1>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Confira se o número foi digitado igual ao do PDF (formato SH-AAAA-XXXXXXXX). Se o erro continuar, fale com a gente pelo site.
            </p>
            <Button asChild className="mt-6"><Link href="/">Voltar ao site</Link></Button>
          </div>
        )}
      </main>
    </div>
  );
}
