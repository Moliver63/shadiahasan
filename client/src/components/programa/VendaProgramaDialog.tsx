import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { reaisParaCentavos, validarPrecos } from "@shared/comercial";
import { textoSugeridoPara } from "@shared/catalogoSugerido";
import PrecoPrograma from "./PrecoPrograma";

function centavosParaTexto(c: number | null | undefined): string {
  return c == null ? "" : (c / 100).toFixed(2).replace(".", ",");
}

type Props = { col: any | null; onClose: () => void; onSaved: () => void };

/** Admin: preço (original e promocional) e textos da página de venda de um Programa. */
export default function VendaProgramaDialog({ col, onClose, onSaved }: Props) {
  const [preco, setPreco] = useState("");
  const [original, setOriginal] = useState("");
  const [headline, setHeadline] = useState("");
  const [descricao, setDescricao] = useState("");
  const [paraQuem, setParaQuem] = useState("");
  const [aprende, setAprende] = useState("");
  const [cta, setCta] = useState("");

  useEffect(() => {
    if (!col) return;
    setPreco(centavosParaTexto(col.priceCents));
    setOriginal(centavosParaTexto(col.originalPriceCents));
    setHeadline(col.headline ?? "");
    setDescricao(col.salesDescription ?? "");
    setParaQuem(col.forWhom ?? "");
    setAprende(col.learnings ?? "");
    setCta(col.ctaText ?? "");
  }, [col]);

  const salvar = trpc.collections.update.useMutation({
    onSuccess: () => { toast.success("Venda do programa salva."); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const precoC = preco.trim() ? reaisParaCentavos(preco) : null;
  const originalC = original.trim() ? reaisParaCentavos(original) : null;
  const formatoInvalido = (preco.trim() && precoC === null) || (original.trim() && originalC === null);
  const erro = formatoInvalido ? "Use só números, como 197,00." : validarPrecos(precoC, originalC) ?? (originalC != null && precoC == null ? "Informe o preço de venda." : null);
  const sugerido = col ? textoSugeridoPara(col.id, col.title) : null;

  function usarSugerido() {
    if (!sugerido) return;
    setHeadline(sugerido.headline);
    setDescricao(sugerido.salesDescription);
    setParaQuem(sugerido.forWhom);
    setAprende(sugerido.learnings);
    setCta(sugerido.ctaText);
    setPreco(centavosParaTexto(sugerido.priceCents));
    setOriginal(centavosParaTexto(sugerido.originalPriceCents));
    toast.info("Texto sugerido carregado. Revise e salve.");
  }

  return (
    <Dialog open={!!col} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Venda: {col?.title}</DialogTitle>
          <DialogDescription>
            Preço e textos da página do programa. O preço só aparece no site com o modelo "Compra individual" ligado em Comercial.
          </DialogDescription>
        </DialogHeader>

        {sugerido && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3">
            <p className="text-sm text-muted-foreground">Há um texto sugerido para este programa, baseado nas aulas e na página da Hotmart.</p>
            <Button variant="outline" size="sm" onClick={usarSugerido}><Sparkles className="h-4 w-4 mr-1.5" />Usar sugerido</Button>
          </div>
        )}

        <div className="space-y-5 py-1">
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="vpOriginal">Preço original (riscado), R$</Label>
              <Input id="vpOriginal" inputMode="decimal" placeholder="597,00" value={original} onChange={(e) => setOriginal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vpPreco">Preço de venda, R$</Label>
              <Input id="vpPreco" inputMode="decimal" placeholder="197,00" value={preco} onChange={(e) => setPreco(e.target.value)} />
            </div>
            <div className="rounded-lg border px-3 py-2 min-w-[150px]">
              {precoC != null && !erro ? <PrecoPrograma priceCents={precoC} originalPriceCents={originalC} /> : <span className="text-xs text-muted-foreground">Prévia do preço</span>}
            </div>
          </div>
          {erro ? <p className="text-sm text-destructive -mt-2">{erro}</p> : (
            <p className="text-xs text-muted-foreground -mt-2">
              Deixe o preço de venda vazio para não vender avulso. Só use preço original se ele foi de fato praticado (CDC).
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="vpHeadline">Título de destaque</Label>
            <Input id="vpHeadline" maxLength={255} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Uma pergunta ou frase que fale com a dor de quem chega" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vpDesc">Descrição da página</Label>
            <Textarea id="vpDesc" rows={7} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Parágrafos separados por uma linha em branco" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vpQuem">Para quem é (uma por linha)</Label>
              <Textarea id="vpQuem" rows={5} value={paraQuem} onChange={(e) => setParaQuem(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vpAprende">O que vai aprender (uma por linha)</Label>
              <Textarea id="vpAprende" rows={5} value={aprende} onChange={(e) => setAprende(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vpCta">Chamada final</Label>
            <Input id="vpCta" maxLength={120} value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Evite promessa de cura ou de resultado garantido. O conteúdo das aulas aparece sozinho na página, a partir do programa.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!!erro || salvar.isPending}
            onClick={() => col && salvar.mutate({
              id: col.id,
              priceCents: precoC,
              originalPriceCents: originalC,
              headline: headline || null,
              salesDescription: descricao || null,
              forWhom: paraQuem || null,
              learnings: aprende || null,
              ctaText: cta || null,
            })}
          >
            {salvar.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
