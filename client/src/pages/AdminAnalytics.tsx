import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart2,
  ExternalLink,
  Mail,
  TrendingUp,
  Users,
  MousePointerClick,
  Eye,
  Activity,
  Download,
} from "lucide-react";

const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID as string | undefined;

function StatusBadge({ id, label }: { id?: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block w-2 h-2 rounded-full ${id ? "bg-green-500" : "bg-yellow-400 animate-pulse"}`}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
      {id ? (
        <Badge variant="outline" className="text-xs font-mono">{id}</Badge>
      ) : (
        <Badge variant="secondary" className="text-xs">Não configurado</Badge>
      )}
    </div>
  );
}

export default function AdminAnalytics() {
  const { data: leads, isLoading: leadsLoading } = trpc.leads.listAll.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.admin.getStats.useQuery();

  // Exportar leads como CSV
  const exportLeadsCSV = () => {
    if (!leads?.length) return;
    const header = "id,email,nome,fonte,criado_em";
    const rows = leads.map((l) =>
      [l.id, l.email, l.name ?? "", l.source, new Date(l.createdAt).toLocaleDateString("pt-BR")].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-shadiahasan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Agrupar leads por fonte
  const leadsBySource = leads?.reduce<Record<string, number>>((acc, l) => {
    acc[l.source] = (acc[l.source] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  // Leads últimos 7 dias
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentLeads = leads?.filter((l) => new Date(l.createdAt) > sevenDaysAgo).length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Analytics & Marketing</h1>
          <p className="text-muted-foreground">
            Métricas de tráfego, leads capturados e conversão da plataforma.
          </p>
        </div>

        {/* Status dos pixels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Status dos Rastreadores
            </CardTitle>
            <CardDescription>
              Configure as env vars no Render para ativar cada rastreador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBadge id={GA4_ID} label="Google Analytics 4" />
            <StatusBadge id={META_PIXEL_ID} label="Meta Pixel" />
            <StatusBadge id={CLARITY_ID} label="Microsoft Clarity" />
          </CardContent>
        </Card>

        {/* KPIs de leads */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Mail className="h-4 w-4" /> Total de Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{leads?.length ?? 0}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> Últimos 7 dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{recentLeads}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" /> Total Alunos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{stats?.totalStudents ?? 0}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MousePointerClick className="h-4 w-4" /> Matrículas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{stats?.totalEnrollments ?? 0}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Leads por fonte */}
        {Object.keys(leadsBySource).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leads por Origem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(leadsBySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center gap-3">
                      <span className="text-sm w-32 text-muted-foreground capitalize">{source}</span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${(count / (leads?.length ?? 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela de leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Lista de Leads</CardTitle>
              <CardDescription>Emails capturados pelo lead magnet da home.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportLeadsCSV}
              disabled={!leads?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            {leadsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !leads?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum lead capturado ainda.</p>
                <p className="text-xs mt-1">Os emails do formulário da home aparecem aqui.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Email</th>
                      <th className="text-left py-2 pr-4 font-medium">Nome</th>
                      <th className="text-left py-2 pr-4 font-medium">Fonte</th>
                      <th className="text-left py-2 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2.5 pr-4 font-mono text-xs">{lead.email}</td>
                        <td className="py-2.5 pr-4">{lead.name ?? "—"}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="secondary" className="text-xs">{lead.source}</Badge>
                        </td>
                        <td className="py-2.5 text-muted-foreground text-xs">
                          {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Links externos */}
        <div className="grid gap-4 md:grid-cols-3">
          {GA4_ID && (
            <Card className="border-blue-200 dark:border-blue-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-blue-500" />
                  Google Analytics 4
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Visitas, fontes de tráfego, funil de conversão e comportamento de usuários.
                </p>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a
                    href={`https://analytics.google.com/analytics/web/#/p${GA4_ID.replace("G-", "")}/reports/intelligenthome`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    Abrir GA4
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {META_PIXEL_ID && (
            <Card className="border-indigo-200 dark:border-indigo-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-indigo-500" />
                  Meta Pixel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Eventos de conversão, alcance de anúncios e audiências personalizadas.
                </p>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a
                    href={`https://business.facebook.com/events_manager/pixel/meta_pixel/${META_PIXEL_ID}/overview`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    Abrir Meta
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {CLARITY_ID && (
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-green-500" />
                  Microsoft Clarity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Gravação de sessões, mapas de calor e pontos de abandono na página.
                </p>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a
                    href={`https://clarity.microsoft.com/projects/view/${CLARITY_ID}/dashboard`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    Abrir Clarity
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {!GA4_ID && !META_PIXEL_ID && !CLARITY_ID && (
            <Card className="md:col-span-3 border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Nenhum rastreador configurado</p>
                <p className="text-xs mt-1">
                  Adicione VITE_GA4_ID, VITE_META_PIXEL_ID e VITE_CLARITY_ID no Render → Environment.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
