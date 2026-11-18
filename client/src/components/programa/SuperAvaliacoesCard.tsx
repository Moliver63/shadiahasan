/**
 * Lista das Super Avaliações (R$ 15) no /admin/comercial. Mostra quem pediu, o status
 * e, se a IA travou depois do pagamento, permite tentar de novo.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatarReais } from "@shared/comercial";

const STATUS: Record<string, { rotulo: string; classe: string }> = {
  ready: { rotulo: "Entregue", classe: "bg-emerald-100 text-emerald-800" },
  paid: { rotulo: "Paga, na fila", classe: "bg-sky-100 text-sky-800" },
  generating: { rotulo: "Gerando", classe: "bg-sky-100 text-sky-800" },
  pending: { rotulo: "Aguardando pagamento", classe: "bg-amber-100 text-amber-900" },
  refunded: { rotulo: "Estornada", classe: "bg-rose-100 text-rose-800" },
  failed: { rotulo: "Falhou", classe: "bg-rose-100 text-rose-800" },
  cancelled: { rotulo: "Cancelada", classe: "bg-muted text-muted-foreground" },
};

export default function SuperAvaliacoesCard() {
  const lista = trpc.comercial.avaliacoes.useQuery();
  const deNovo = trpc.comercial.gerarAvaliacaoDeNovo.useMutation({
    onSuccess: (r) => { toast[r.pronta ? "success" : "error"](r.pronta ? "Avaliação gerada e enviada." : "A IA falhou de novo. Veja o erro na lista."); lista.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const itens = lista.data ?? [];
  const entregues = itens.filter((a) => a.status === "ready");
  const receita = entregues.reduce((n, a) => n + a.amountCents, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Super Avaliações do Diário</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {entregues.length} entregue{entregues.length === 1 ? "" : "s"} · {formatarReais(receita)}. Se a IA falhar 6 vezes, a cobrança é estornada sozinha.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => lista.refetch()} disabled={lista.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${lista.isFetching ? "animate-spin" : ""}`} />Atualizar
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {lista.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma avaliação pedida ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Pessoa</th>
                <th className="py-2 pr-3 font-medium">Onde</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((a) => {
                const st = STATUS[a.status] ?? { rotulo: a.status, classe: "bg-muted" };
                const travada = (a.status === "paid" || a.status === "failed") && a.tentativas > 0;
                return (
                  <tr key={a.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{new Date(a.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="py-2 pr-3"><div>{a.nome}</div><div className="text-muted-foreground">{a.email}</div></td>
                    <td className="py-2 pr-3">{a.origem === "diario" ? "Diário do aluno" : "Exercício grátis"}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary" className={st.classe}>{st.rotulo}</Badge>
                      {a.ultimoErro && a.status !== "ready" && <div className="text-xs text-destructive mt-1 max-w-[280px] truncate" title={a.ultimoErro}>{a.tentativas} tentativa(s): {a.ultimoErro}</div>}
                    </td>
                    <td className="py-2 text-right">
                      {travada && (
                        <Button variant="ghost" size="sm" disabled={deNovo.isPending} onClick={() => deNovo.mutate({ id: a.id })}>Gerar de novo</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
