import { formatarReais, percentualDesconto } from "@shared/comercial";
import { cn } from "@/lib/utils";

type Props = {
  priceCents: number;
  originalPriceCents?: number | null;
  tamanho?: "sm" | "lg";
  className?: string;
};

/** Preço do Programa: "de" riscado (quando existe e é maior) e preço de venda em destaque. */
export default function PrecoPrograma({ priceCents, originalPriceCents, tamanho = "sm", className }: Props) {
  const desconto = percentualDesconto(priceCents, originalPriceCents);
  const grande = tamanho === "lg";
  return (
    <div className={cn("flex flex-col", className)} aria-label={`Preço: ${formatarReais(priceCents)}`}>
      {desconto !== null && originalPriceCents ? (
        <span className={cn("text-muted-foreground", grande ? "text-sm" : "text-xs")}>
          de <s>{formatarReais(originalPriceCents)}</s>
        </span>
      ) : null}
      <span className="flex items-baseline gap-2 flex-wrap">
        <span className={cn("font-semibold tracking-tight text-foreground tabular-nums", grande ? "text-4xl" : "text-lg")}>
          {formatarReais(priceCents)}
        </span>
        {desconto !== null ? (
          <span className={cn("rounded-full bg-emerald-100 text-emerald-800 font-medium", grande ? "px-2.5 py-0.5 text-xs" : "px-2 py-0.5 text-[11px]")}>
            {desconto}% off
          </span>
        ) : null}
      </span>
      {grande ? <span className="text-xs text-muted-foreground mt-1">Pagamento único, sem mensalidade</span> : null}
    </div>
  );
}
