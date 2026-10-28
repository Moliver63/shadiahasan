import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { AlertCircle, CheckCircle2, CircleDashed, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { trpc } from "@/lib/trpc";

type Periodo = 7 | 30 | 90;

// Cores com contraste entre si e formas de linha diferentes, para não depender só da cor.
const config = {
  ga4Sessoes: { label: "GA4 · sessões", color: "#E8710A" },
  metaVisitas: { label: "Meta · visitas vindas dos anúncios", color: "#1877F2" },
  claritySessoes: { label: "Clarity · sessões", color: "#0E9F8E" },
} satisfies ChartConfig;

const FONTES = [
  { id: "ga4", nome: "Google Analytics 4" },
  { id: "meta", nome: "Meta Ads" },
  { id: "clarity", nome: "Microsoft Clarity" },
] as const;

const inteiro = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR"));
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Kpi({ rotulo, valor, cor, detalhe }: { rotulo: string; valor: number | null; cor: string; detalhe: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
        {rotulo}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{inteiro(valor)}</p>
      <p className="text-xs text-muted-foreground">{detalhe}</p>
    </div>
  );
}

export function AcessosChart() {
  const [dias, setDias] = useState<Periodo>(30);
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.acessos.porDia.useQuery({ dias }, { staleTime: 60_000, retry: false });
  const [atualizando, setAtualizando] = useState(false);

  const atualizar = async () => {
    setAtualizando(true);
    try {
      const novo = await utils.acessos.porDia.fetch({ dias, forcar: true });
      utils.acessos.porDia.setData({ dias }, novo);
    } finally {
      setAtualizando(false);
    }
  };

  const algumaFonteOk = !!data && FONTES.some((f) => data.fontes[f.id].ok);
  const serie = (data?.serie ?? []).map((p) => ({ ...p, rotulo: diaCurto(p.data) }));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Acessos ao site</CardTitle>
          <CardDescription>Visitas por dia, lidas do GA4, da Meta e do Clarity. Horário de Brasília.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(dias)} onValueChange={(v) => setDias(Number(v) as Periodo)}>
            <TabsList>
              <TabsTrigger value="7">7 dias</TabsTrigger>
              <TabsTrigger value="30">30 dias</TabsTrigger>
              <TabsTrigger value="90">90 dias</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" onClick={atualizar} disabled={atualizando || isLoading} aria-label="Atualizar acessos" title="Buscar dados novos agora">
            <RefreshCw className={`h-4 w-4 ${atualizando ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error || !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Não foi possível carregar os acessos agora. {error?.message}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi rotulo="GA4 · sessões" valor={data.totais.ga4Sessoes} cor={config.ga4Sessoes.color} detalhe={data.fontes.ga4.ok ? `${inteiro(data.totais.ga4Visualizacoes)} visualizações de página` : "sem leitura"} />
              <Kpi rotulo="Meta · visitas dos anúncios" valor={data.totais.metaVisitas} cor={config.metaVisitas.color} detalhe={data.fontes.meta.ok ? `${inteiro(data.totais.metaCliques)} cliques · ${inteiro(data.totais.metaImpressoes)} impressões` : "sem leitura"} />
              <Kpi rotulo="Clarity · sessões" valor={data.totais.claritySessoes} cor={config.claritySessoes.color} detalhe={data.fontes.clarity.ok ? "sem robôs, um registro por dia" : "sem leitura"} />
              <Kpi
                rotulo="GA4 · média por dia"
                valor={data.totais.ga4Sessoes != null ? Math.round(data.totais.ga4Sessoes / data.dias) : null}
                cor="#6B7280"
                detalhe={data.fontes.ga4.ok ? `sessões por dia nos últimos ${data.dias} dias` : "sem leitura"}
              />
            </div>

            {algumaFonteOk ? (
              <ChartContainer config={config} className="h-64 w-full">
                <LineChart data={serie} margin={{ left: 0, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, itens) => { const d = itens?.[0]?.payload?.data as string | undefined; return d ? `${diaCurto(d)}/${d.slice(0, 4)}` : ""; }} />} />
                  {data.fontes.ga4.ok && <Line dataKey="ga4Sessoes" type="monotone" stroke="var(--color-ga4Sessoes)" strokeWidth={2.5} dot={dias <= 14} />}
                  {data.fontes.meta.ok && <Line dataKey="metaVisitas" type="monotone" stroke="var(--color-metaVisitas)" strokeWidth={2} strokeDasharray="6 3" dot={dias <= 14} />}
                  {data.fontes.clarity.ok && <Line dataKey="claritySessoes" type="monotone" stroke="var(--color-claritySessoes)" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma das três fontes está conectada ainda. Adicione as variáveis abaixo no Render e o gráfico aparece sozinho.
              </div>
            )}

            <ul className="space-y-2 border-t pt-4 text-sm">
              {FONTES.map((f) => {
                const e = data.fontes[f.id];
                const Icone = e.ok ? CheckCircle2 : e.configurada ? AlertCircle : CircleDashed;
                const cor = e.ok ? "text-green-600" : e.configurada ? "text-amber-600" : "text-muted-foreground";
                return (
                  <li key={f.id} className="flex items-start gap-2">
                    <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${cor}`} />
                    <div className="min-w-0">
                      <span className="font-medium">{f.nome}</span>{" "}
                      <span className="text-muted-foreground">
                        {e.ok ? "conectado" : e.configurada ? "erro na leitura" : "não conectado"}
                      </span>
                      {e.erro && <p className="break-words text-xs text-amber-700">{e.erro}</p>}
                      {!e.configurada && (
                        <p className="text-xs text-muted-foreground">
                          Falta no Render: {e.faltando.map((n) => <code key={n} className="mr-1 rounded bg-muted px-1 py-0.5">{n}</code>)}
                        </p>
                      )}
                      {e.ok && e.nota && <p className="text-xs text-muted-foreground">{e.nota}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
