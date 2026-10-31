import { Checkbox } from "@/components/ui/checkbox";
import { TEXTO_CONSENTIMENTO } from "@/lib/consentimento";

/**
 * Caixa de autorização de e-mail marketing (LGPD). Sempre começa desmarcada: quem
 * controla o estado deve iniciar com `false` e nunca marcar por conta própria.
 */
export function AutorizacaoEmail({ id, marcada, onChange, className = "" }: { id: string; marcada: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <Checkbox id={id} checked={marcada} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5 h-5 w-5 shrink-0" />
      <label htmlFor={id} className="cursor-pointer text-left text-sm leading-snug text-muted-foreground">
        {TEXTO_CONSENTIMENTO}{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Política de privacidade</a>
      </label>
    </div>
  );
}
