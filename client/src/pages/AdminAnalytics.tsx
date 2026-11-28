import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { AcessosChart } from "@/components/AcessosChart";
import { ContatosDeEmail, LinkDeCampanha, Rastreadores, VendasPorOrigem } from "@/components/analytics/PainelMarketing";
import { ExternalLink } from "lucide-react";

const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const CLARITY_ID = (import.meta.env.VITE_CLARITY_ID as string | undefined) || "z3xy56e2y4";

const FERRAMENTAS = [
  { nome: "Google Analytics", url: "https://analytics.google.com/analytics/web/" },
  { nome: "Meta Events Manager", url: META_PIXEL_ID ? `https://business.facebook.com/events_manager2/list/dataset/${META_PIXEL_ID}/overview` : "https://business.facebook.com/events_manager2" },
  { nome: "TikTok Ads", url: "https://ads.tiktok.com/" },
  { nome: "Microsoft Clarity", url: `https://clarity.microsoft.com/projects/view/${CLARITY_ID}/dashboard` },
];

export default function AdminAnalytics() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="mb-1 text-3xl font-bold tracking-tight">Analytics & Marketing</h1>
          <p className="text-muted-foreground">Vendas por origem, rastreamento, acessos e contatos.</p>
        </div>
        <VendasPorOrigem />
        <LinkDeCampanha />
        <AcessosChart />
        <Rastreadores />
        <ContatosDeEmail />
        <div className="flex flex-wrap gap-2">
          {FERRAMENTAS.map((f) => (
            <Button key={f.nome} variant="outline" size="sm" asChild>
              <a href={f.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-3 w-3" />{f.nome}</a>
            </Button>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
