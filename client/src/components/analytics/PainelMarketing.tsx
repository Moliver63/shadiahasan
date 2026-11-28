/** Blocos do painel Analytics & Marketing: rastreadores, vendas por origem, link de campanha e contatos. */
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { montarCsv, montarLinkDeCampanha } from "@/lib/campanhaLink";
import { TIKTOK_PIXEL_ID } from "@/lib/tiktokPixel";

const GA4_ID = (import.meta.env.VITE_GA4_ID as string | undefined) || "G-DGCPN51SD6";
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const CLARITY_ID = (import.meta.env.VITE_CLARITY_ID as string | undefined) || "z3xy56e2y4";

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const Falha = ({ texto }: { texto: string }) => <p className="text-sm text-destructive">Não foi possível carregar: {texto}</p>;

function Linha({ nome, ok, detalhe, alerta }: { nome: string; ok: boolean; detalhe: string; alerta?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{nome}</p>
        <p className="break-words text-xs text-muted-foreground">{detalhe}</p>
      </div>
      <Badge variant={ok && !alerta ? "outline" : alerta ? "destructive" : "secondary"} className="shrink-0 text-xs">
        {alerta ? "Modo teste" : ok ? "Ligado" : "Desligado"}
      </Badge>
    </li>
  );
}

export function Rastreadores() {
  const { data, error, isLoading } = trpc.conversoes.configuracao.useQuery();
  type Item = NonNullable<typeof data>["metaServidor"];
  const servidor = (nome: string, i: Item, efeito: string) => (
    <Linha
      nome={nome}
      ok={i.ligado}
      alerta={i.ligado && !!i.modoTeste}
      detalhe={!i.ligado ? `${efeito} Falta no Render: ${i.faltando.join(", ")}` : i.modoTeste ? `Os envios não contam como conversão. Remova ${i.modoTeste} no Render.` : "Configurado no servidor."}
    />
  );
  const navegador = (nome: string, id?: string) => <Linha nome={nome} ok={!!id} detalhe={id || "Sem identificador no build do site."} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No navegador</CardTitle>
          <CardDescription>Só funcionam para quem aceita os cookies de análise.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {navegador("Google Analytics 4", GA4_ID)}
            {navegador("Meta Pixel", META_PIXEL_ID)}
            {navegador("TikTok Pixel", TIKTOK_PIXEL_ID)}
            {navegador("Microsoft Clarity", CLARITY_ID)}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No servidor (vendas e e-mail)</CardTitle>
          <CardDescription>Mostra se a variável existe, não se a chave é válida.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32 w-full" /> : error || !data ? <Falha texto={error?.message ?? "sem dados"} /> : (
            <ul className="space-y-2">
              {servidor("Compra para a Meta", data.metaServidor, "A Meta não recebe nenhuma venda.")}
              {servidor("Compra para o GA4", data.ga4Servidor, "Venda por Pix só conta se a pessoa voltar ao site.")}
              {servidor("Compra para o TikTok", data.tiktokServidor, "O TikTok não recebe vendas.")}
              {servidor("Envio de e-mails", data.email, "Nenhum e-mail sai.")}
              {servidor("Aviso de venda por e-mail", data.avisoDeVenda, "A equipe não é avisada por e-mail.")}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function VendasPorOrigem() {
  const [dias, setDias] = useState(30);
  const { data, error, isLoading } = trpc.conversoes.vendas.useQuery({ dias });
  const taxa = data?.total.cobrancas ? Math.round((data.total.pagas / data.total.cobrancas) * 100) : 0;
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Vendas por origem</CardTitle>
          <CardDescription>Aula avulsa e programas, direto do banco (conta também quem recusou cookies).</CardDescription>
        </div>
        <Tabs value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
          <TabsList>
            <TabsTrigger value="30">30 dias</TabsTrigger>
            <TabsTrigger value="90">90 dias</TabsTrigger>
            <TabsTrigger value="365">1 ano</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? <Skeleton className="h-40 w-full" /> : error || !data ? <Falha texto={error?.message ?? "sem dados"} /> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Cobranças geradas", String(data.total.cobrancas)], ["Vendas pagas", String(data.total.pagas)], ["Pagas / geradas", `${taxa}%`], ["Receita", reais(data.total.receitaCentavos)]].map(([r, v]) => (
                <div key={r} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{r}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            {data.porOrigem.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma cobrança no período.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3 font-medium">Origem / campanha</th><th className="py-2 pr-3 text-right font-medium">Geradas</th><th className="py-2 pr-3 text-right font-medium">Pagas</th><th className="py-2 text-right font-medium">Receita</th></tr></thead>
                  <tbody>
                    {data.porOrigem.map((o) => (
                      <tr key={`${o.origem}|${o.campanha}`} className="border-b last:border-0">
                        <td className="py-2 pr-3">{o.origem}{o.campanha && <span className="block text-xs text-muted-foreground">{o.campanha}</span>}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{o.cobrancas}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{o.pagas}</td>
                        <td className="py-2 text-right tabular-nums">{reais(o.receitaCentavos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.vendas.length > 0 && (
              <div className="overflow-x-auto">
                <h3 className="mb-2 text-sm font-medium">A venda chegou às plataformas?</h3>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3 font-medium">Venda</th><th className="py-2 pr-3 font-medium">Meta</th><th className="py-2 pr-3 font-medium">GA4</th><th className="py-2 font-medium">TikTok</th></tr></thead>
                  <tbody>
                    {data.vendas.map((v) => (
                      <tr key={v.cobranca} className="border-b last:border-0">
                        <td className="py-2 pr-3">{v.produto}<span className="block text-xs text-muted-foreground">{dataBr(v.pagoEm)} · {reais(v.centavos)}{v.consentiu ? "" : " · sem identificador de cookies"}</span></td>
                        {[v.meta, v.ga4, v.tiktok].map((ok, i) => <td key={i} className="py-2 pr-3">{ok ? "Sim" : "Não"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">"Sim" quer dizer enviada pelo servidor. O GA4 também pode ter recebido pelo navegador.</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function LinkDeCampanha() {
  const [f, setF] = useState({ caminho: "/", origem: "instagram", meio: "social", campanha: "", conteudo: "" });
  const link = montarLinkDeCampanha(f);
  const campos: Array<[keyof typeof f, string, string]> = [
    ["caminho", "Página de destino", "/collections/8"],
    ["origem", "Origem", "instagram, facebook, google, tiktok, email"],
    ["meio", "Meio", "social, cpc, bio, stories"],
    ["campanha", "Nome da campanha", "aula-19-90-dezembro"],
    ["conteudo", "Anúncio ou peça (opcional)", "video-1"],
  ];
  const copiar = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast.success("Link copiado."); }
    catch { toast.error("Não deu para copiar. Selecione o link e copie."); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Criar link de campanha</CardTitle>
        <CardDescription>Use este link em anúncios, bio e e-mails para a venda aparecer com a origem.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {campos.map(([chave, rotulo, exemplo]) => (
            <div key={chave} className="space-y-1">
              <Label htmlFor={`utm-${chave}`}>{rotulo}</Label>
              <Input id={`utm-${chave}`} value={f[chave]} placeholder={exemplo} onChange={(e) => setF({ ...f, [chave]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="flex-1 break-all rounded-md border bg-muted/40 p-2 font-mono text-xs">{link ?? "Preencha origem e nome da campanha."}</p>
          <Button size="sm" onClick={copiar} disabled={!link}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContatosDeEmail() {
  const utils = trpc.useUtils();
  const { data, error, isLoading } = trpc.marketing.contatos.useQuery();
  const reenviar = trpc.marketing.reenviarConfirmacao.useMutation({
    onSuccess: () => { toast.success("E-mail de confirmação enviado."); utils.marketing.contatos.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const quantos = (s: string) => data?.filter((c) => c.situacao === s).length ?? 0;
  const exportar = () => {
    if (!data?.length) return;
    const csv = montarCsv([["email", "nome", "origem", "situacao", "criado_em"], ...data.map((c) => [c.email, c.nome ?? "", c.rotulo, c.situacao, dataBr(c.criadoEm)])]);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos-shadiahasan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Contatos de e-mail</CardTitle>
          <CardDescription>{quantos("confirmado")} confirmados · {quantos("pendente")} aguardando · {quantos("cancelado")} cancelados. Só confirmados recebem campanhas.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild><a href="/admin/campanhas">Campanhas</a></Button>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!data?.length}><Download className="mr-2 h-4 w-4" />CSV</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-24 w-full" /> : error ? <Falha texto={error.message} /> : !data?.length ? (
          <p className="text-sm text-muted-foreground">Ninguém autorizou receber e-mails ainda.</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {data.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 border-b pb-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all text-sm">{c.email}</p>
                  <p className="text-xs text-muted-foreground">{c.rotulo} · {dataBr(c.criadoEm)} · {c.situacao}</p>
                </div>
                {c.situacao === "pendente" && (
                  <Button variant="outline" size="sm" disabled={reenviar.isPending} onClick={() => reenviar.mutate({ id: c.id })}>
                    <Send className="mr-2 h-3 w-3" />Reenviar confirmação
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
