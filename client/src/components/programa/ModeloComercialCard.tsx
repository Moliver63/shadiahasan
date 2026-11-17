import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Check, Repeat, ShoppingBag, Store, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { METODOS, NOME_METODO, type MetodosAtivos, type ModeloComercial } from "@shared/comercial";
import { cn } from "@/lib/utils";

const OPCOES: Array<{ valor: ModeloComercial; titulo: string; icone: LucideIcon; texto: string }> = [
  { valor: "assinatura", titulo: "Assinatura", icone: Repeat, texto: "O site oferece os planos mensais. O acesso segue o plano de cada aluno." },
  { valor: "avulso", titulo: "Compra individual", icone: ShoppingBag, texto: "Cada programa com preço mostra \"Quero começar\" e tem checkout próprio, sem mensalidade." },
];

/** Configurações > Modelo de Comercialização. Persistido no banco, sem deploy. */
export default function ModeloComercialCard() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.comercial.adminConfig.useQuery();
  const { data: resumo = [] } = trpc.comercial.resumo.useQuery();
  const { data: programas = [] } = trpc.collections.adminList.useQuery();
  const [pendente, setPendente] = useState<ModeloComercial | null>(null);

  const definirModelo = trpc.comercial.definirModelo.useMutation({
    onSuccess: () => { toast.success("Modelo comercial atualizado. O site já mostra a mudança."); utils.comercial.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const definirMetodos = trpc.comercial.definirMetodos.useMutation({
    onSuccess: () => { toast.success("Formas de pagamento salvas."); utils.comercial.adminConfig.invalidate(); utils.comercial.config.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const modelo = data?.modelo;
  const comPreco = (programas as any[]).filter((p) => p.isActive === 1 && p.priceCents);
  const pendentesTotal = resumo.reduce((a, r) => a + r.pendentes, 0);

  function alternarMetodo(m: keyof MetodosAtivos, ligado: boolean) {
    if (!data) return;
    definirMetodos.mutate({ ...data.metodos, [m]: ligado });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />Modelo de Comercialização</CardTitle>
        <CardDescription>
          Escolha como o site vende. Trocar o modelo não cancela assinaturas, não revoga compras e não altera cobranças já feitas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div role="radiogroup" aria-label="Modelo comercial" className="grid sm:grid-cols-2 gap-3">
          {OPCOES.map(({ valor, titulo, icone: Icone, texto }) => {
            const ativo = modelo === valor;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                disabled={isLoading || definirModelo.isPending}
                onClick={() => !ativo && setPendente(valor)}
                className={cn(
                  "relative rounded-xl border p-4 text-left transition-all disabled:opacity-60",
                  ativo ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:border-primary/50",
                )}
              >
                {ativo && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground"><Check className="h-3 w-3" />Ativo</span>}
                <Icone className={cn("h-5 w-5 mb-2", ativo ? "text-primary" : "text-muted-foreground")} />
                <p className="font-medium">{titulo}</p>
                <p className="text-sm text-muted-foreground mt-1">{texto}</p>
              </button>
            );
          })}
        </div>

        {modelo === "avulso" && !data?.asaasConfigurado && (
          <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />O Asaas não está configurado (ASAAS_API_KEY). Os preços não aparecem até a chave ser cadastrada.
          </p>
        )}
        {modelo === "avulso" && comPreco.length === 0 && (
          <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />Nenhum programa ativo tem preço. Defina em Agrupamentos, no botão de etiqueta.
          </p>
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium">Formas de pagamento da compra individual</p>
          <div className="flex flex-wrap gap-6">
            {METODOS.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <Switch
                  id={`metodo-${m}`}
                  checked={!!data?.metodos[m]}
                  disabled={!data || definirMetodos.isPending}
                  onCheckedChange={(v) => alternarMetodo(m, v)}
                />
                <Label htmlFor={`metodo-${m}`}>{NOME_METODO[m]}</Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Precisam estar habilitadas também na sua conta Asaas.</p>
        </div>

        {data?.historico?.length ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Histórico de alterações</summary>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {data.historico.map((h, i) => (
                <li key={i}>
                  {new Date(h.changedAt).toLocaleString("pt-BR")} · {h.adminNome || "admin"} · {h.key === "modeloComercial" ? "Modelo" : "Formas de pagamento"}: {h.oldValue ?? "padrão"} → {h.newValue}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>

      <AlertDialog open={!!pendente} onOpenChange={(o) => { if (!o) setPendente(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mudar para {pendente === "avulso" ? "Compra individual" : "Assinatura"}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {pendente === "avulso" ? (
                  <p>Os programas com preço passam a mostrar o valor e o botão "Quero começar". {comPreco.length} programa(s) ativo(s) com preço.</p>
                ) : (
                  <p>Os preços e os botões de compra somem da vitrine e o site volta a oferecer os planos.{pendentesTotal > 0 ? ` ${pendentesTotal} cobrança(s) avulsa(s) pendente(s) continuam valendo: se forem pagas, o programa é liberado.` : ""}</p>
                )}
                <p>Assinantes continuam com o plano. Quem comprou um programa continua com ele.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendente) definirModelo.mutate({ modelo: pendente }); setPendente(null); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
