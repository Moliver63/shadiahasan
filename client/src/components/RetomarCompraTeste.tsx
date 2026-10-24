import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { lerIntencao } from "@/lib/trialIntent";

/**
 * Depois do login, quem tinha começado a comprar o teste de 1 aula volta para a
 * oferta na home, onde o pagamento reabre sozinho (ver TrialOfferSection).
 * O login manda para /courses ou /admin; sem isto a compra se perdia.
 */
export default function RetomarCompraTeste() {
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  useEffect(() => {
    if (!isAuthenticated || location === "/" || location.startsWith("/login") || location.startsWith("/signup")) return;
    if (lerIntencao() !== null) setLocation("/#experimente-uma-aula");
  }, [isAuthenticated, location, setLocation]);
  return null;
}
