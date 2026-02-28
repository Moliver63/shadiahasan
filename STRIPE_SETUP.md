# Configuração do Stripe

## Status Atual

✅ **Product IDs configurados:**
- Básico: `prod_U0eqO9v4LHNm06`
- Premium: `prod_U0f1fmv8sHeo4u`
- VIP: `prod_U0f1YgyCp6HGP0`

⏳ **Pendente: Price IDs**

Os Price IDs são necessários para completar a integração de pagamentos.

## Como Adicionar os Price IDs

### 1. Encontrar os Price IDs no Stripe Dashboard

1. Acesse [Stripe Dashboard](https://dashboard.stripe.com)
2. Vá em **Produtos** no menu lateral
3. Clique em cada produto (Básico, Premium, VIP)
4. Na página do produto, você verá os preços listados
5. Copie o **Price ID** de cada preço (começa com `price_`)

Exemplo:
```
Produto: Premium (prod_U0f1fmv8sHeo4u)
  └─ R$ 99,90/mês
     Price ID: price_1234567890abcdef ← Copie este
```

### 2. Atualizar o Arquivo de Configuração

Abra o arquivo `shared/stripe-config.ts` e adicione os Price IDs:

```typescript
export const STRIPE_PRODUCTS = {
  basic: {
    productId: 'prod_U0eqO9v4LHNm06',
    priceId: 'price_XXXXX', // ← Cole aqui o Price ID do Básico
    name: 'Básico',
    slug: 'basic',
  },
  premium: {
    productId: 'prod_U0f1fmv8sHeo4u',
    priceId: 'price_XXXXX', // ← Cole aqui o Price ID do Premium
    name: 'Premium',
    slug: 'premium',
  },
  vip: {
    productId: 'prod_U0f1YgyCp6HGP0',
    priceId: 'price_XXXXX', // ← Cole aqui o Price ID do VIP
    name: 'VIP',
    slug: 'vip',
  },
};
```

### 3. Testar a Integração

Após adicionar os Price IDs:

1. Reinicie o servidor: `pnpm dev`
2. Acesse a página de planos: `/pricing`
3. Clique em "Assinar" em qualquer plano
4. Verifique se o checkout do Stripe abre corretamente

## Arquivos Modificados

- `shared/stripe-config.ts` - Configuração centralizada dos produtos Stripe
- `server/routers.ts` - Router de assinaturas atualizado para usar a configuração

## Próximos Passos

Após adicionar os Price IDs, você precisará:

1. ✅ Configurar Secret Key do Stripe (variável `STRIPE_SECRET_KEY`)
2. ✅ Implementar criação real de checkout session (substituir placeholder)
3. ✅ Configurar webhook do Stripe para processar pagamentos
4. ✅ Testar fluxo completo de assinatura

## Suporte

Se precisar de ajuda, entre em contato com o desenvolvedor ou consulte a [documentação do Stripe](https://stripe.com/docs).
