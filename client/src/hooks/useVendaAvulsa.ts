import { trpc } from "@/lib/trpc";

/**
 * O site está vendendo por "Compra individual" de verdade? (modelo avulso,
 * Asaas configurado, forma de pagamento ligada e ao menos um Programa com preço.)
 * Quando sim, a assinatura sai de cena: as telas oferecem os programas.
 */
export function useVendaAvulsa() {
  const { data, isLoading } = trpc.comercial.config.useQuery(undefined, { staleTime: 30_000 });
  return {
    vendaAvulsa: !!data?.vendaAvulsa,
    programasAVenda: data?.programasAVenda ?? [],
    metodos: data?.metodos ?? [],
    carregando: isLoading,
  };
}
