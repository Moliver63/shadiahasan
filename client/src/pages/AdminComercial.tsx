/**
 * AdminComercial — /admin/comercial
 * Modelo comercial, vendas por programa e compras avulsas (com conferência no Asaas,
 * revogação e liberação manual). Regras em server/programaVenda.ts.
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Gift, Loader2, RefreshCw, Search, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import ModeloComercialCard from "@/components/programa/ModeloComercialCard";
import { formatarReais } from "@shared/comercial";

const STATUS: Record<string, { rotulo: string; classe: string }> = {
  active: { rotulo: "Liberado", classe: "bg-emerald-100 text-emerald-800" },
  pending: { rotulo: "Aguardando pagamento", classe: "bg-amber-100 text-amber-900" },
  refunded: { rotulo: "Estornado", classe: "bg-rose-100 text-rose-800" },
  revoked: { rotulo: "Revogado", classe: "bg-rose-100 text-rose-800" },
  cancelled: { rotulo: "Cancelado", classe: "bg-muted text-muted-foreground" },
};
const FORMA: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "Cartão", BOLETO: "Boleto" };

export default function AdminComercial() {
  const utils = trpc.useUtils();
  const [programa, setPrograma] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [revogar, setRevogar] = useState<any>(null);
  const [motivo, setMotivo] = useState("");
  const [liberarAberto, setLiberarAberto] = useState(false);
  const [libEmail, setLibEmail] = useState("");
  const [libPrograma, setLibPrograma] = useState<string>("");

  const { data: programas = [] } = trpc.collections.adminList.useQuery();
  const { data: resumo = [] } = trpc.comercial.resumo.useQuery();
  const { data: compras = [], isLoading, refetch } = trpc.comercial.compras.useQuery({
    collectionId: programa !== "todos" ? Number(programa) : undefined,
    status: status !== "todos" ? (status as any) : undefined,
    busca: buscaAplicada || undefined,
  });

  const atualizar = () => { refetch(); utils.comercial.resumo.invalidate(); };
  const conferir = trpc.comercial.conferir.useMutation({
    onSuccess: (r) => {
      const msg = r?.resultado === "liberada" ? "Pagamento confirmado no Asaas. Programa liberado." : r?.resultado === "pendente" ? "O Asaas ainda não confirmou este pagamento." : "Cobrança não reconhecida.";
      toast.info(msg); atualizar();
    },
    onError: (e) => toast.error(e.message),
  });
  const revogarM = trpc.comercial.revogar.useMutation({
    onSuccess: () => { toast.success("Acesso revogado."); setRevogar(null); setMotivo(""); atualizar(); },
    onError: (e) => toast.error(e.message),
  });
  const liberarM = trpc.comercial.liberar.useMutation({
    onSuccess: () => { toast.success("Programa liberado para o aluno."); setLiberarAberto(false); setLibEmail(""); atualizar(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold">Comercial</h1>
          <p className="text-sm text-muted-foreground">Como o site vende, quanto cada programa vendeu e quem tem acesso por compra avulsa.</p>
        </div>

        <ModeloComercialCard />

        <Card>
          <CardHeader><CardTitle className="text-base">Vendas avulsas por programa</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-2 pr-4 font-medium">Programa</th><th className="py-2 pr-4 font-medium">Preço</th><th className="py-2 pr-4 font-medium text-right">Vendas</th><th className="py-2 pr-4 font-medium text-right">Receita</th><th className="py-2 pr-4 font-medium text-right">Pendentes</th><th className="py-2 font-medium text-right">Estornos</th></tr>
              </thead>
              <tbody className="divide-y">
                {resumo.map((r) => {
                  const p = (programas as any[]).find((x) => x.id === r.collectionId);
                  return (
                    <tr key={r.collectionId}>
                      <td className="py-2.5 pr-4">{r.programa}{p?.isActive === 0 ? <Badge variant="outline" className="ml-2 text-[10px]">Inativo</Badge> : null}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{p?.priceCents ? <>{p.originalPriceCents ? <s className="text-muted-foreground mr-1">{formatarReais(p.originalPriceCents)}</s> : null}{formatarReais(p.priceCents)}</> : <span className="text-muted-foreground">sem preço</span>}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{r.vendas}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{formatarReais(r.receitaCents)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{r.pendentes}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.estornos}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-3">Receita = compras liberadas via Asaas (sem cortesias). O extrato completo fica em Financeiro.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Compras de programas</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={atualizar}><RefreshCw className="h-4 w-4 mr-1.5" />Atualizar</Button>
              <Button size="sm" onClick={() => setLiberarAberto(true)}><Gift className="h-4 w-4 mr-1.5" />Liberar manualmente</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Select value={programa} onValueChange={setPrograma}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os programas</SelectItem>
                  {(programas as any[]).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setBuscaAplicada(busca.trim()); }}>
                <Input className="w-[220px]" placeholder="Nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <Button type="submit" variant="outline" size="icon" aria-label="Buscar"><Search className="h-4 w-4" /></Button>
              </form>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Aluno</th><th className="px-3 py-2 font-medium">Programa</th>
                    <th className="px-3 py-2 font-medium text-right">Valor</th><th className="px-3 py-2 font-medium">Forma</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando</td></tr>
                  ) : compras.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhuma compra encontrada.</td></tr>
                  ) : compras.map((c) => {
                    const st = STATUS[c.status] ?? { rotulo: c.status, classe: "bg-muted" };
                    return (
                      <tr key={c.id} className="align-top">
                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{new Date(c.paidAt || c.createdAt).toLocaleDateString("pt-BR")}</td>
                        <td className="px-3 py-2.5"><p>{c.nome || "(sem nome)"}</p><p className="text-xs text-muted-foreground">{c.email}</p></td>
                        <td className="px-3 py-2.5">{c.programa}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{c.origem === "manual" ? "cortesia" : formatarReais(c.amountCents)}</td>
                        <td className="px-3 py-2.5">{c.origem === "manual" ? "Manual" : FORMA[c.billingType ?? ""] ?? "Asaas"}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.classe}`}>{st.rotulo}</span>
                          {c.revokedReason ? <p className="text-[11px] text-muted-foreground mt-1 max-w-[180px]">{c.revokedReason}</p> : null}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-right space-x-1">
                          {c.invoiceUrl && <a href={c.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex p-1.5 rounded hover:bg-muted" title="Abrir fatura"><ExternalLink className="h-4 w-4" /></a>}
                          {c.status === "pending" && c.origem === "asaas" && (
                            <Button variant="ghost" size="sm" disabled={conferir.isPending} onClick={() => conferir.mutate({ asaasPaymentId: c.asaasPaymentId })}>Conferir no Asaas</Button>
                          )}
                          {c.status === "active" && (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevogar(c)}><ShieldOff className="h-4 w-4 mr-1" />Revogar</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!revogar} onOpenChange={(o) => { if (!o) { setRevogar(null); setMotivo(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revogar acesso</DialogTitle>
            <DialogDescription>
              {revogar?.nome || revogar?.email} perde o acesso a "{revogar?.programa}". Isso não estorna nada no Asaas: o estorno é feito no painel do Asaas
              (e o webhook já revoga sozinho). Assinatura e outras compras do aluno não mudam.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivoRev">Motivo</Label>
            <Input id="motivoRev" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: pedido de reembolso atendido" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevogar(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={motivo.trim().length < 3 || revogarM.isPending} onClick={() => revogarM.mutate({ compraId: revogar.id, motivo })}>Revogar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={liberarAberto} onOpenChange={setLiberarAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Liberar programa manualmente</DialogTitle>
            <DialogDescription>Para cortesia ou compra feita fora do site. Fica registrado como "Manual", sem valor. A pessoa precisa ter conta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="libEmail">E-mail da conta</Label>
              <Input id="libEmail" type="email" value={libEmail} onChange={(e) => setLibEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Programa</Label>
              <Select value={libPrograma} onValueChange={setLibPrograma}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{(programas as any[]).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiberarAberto(false)}>Cancelar</Button>
            <Button disabled={!libEmail.includes("@") || !libPrograma || liberarM.isPending} onClick={() => liberarM.mutate({ email: libEmail.trim(), collectionId: Number(libPrograma) })}>Liberar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
