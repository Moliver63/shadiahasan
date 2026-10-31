/**
 * Base de contatos para e-mail de novidades e ofertas.
 *
 * Por que existe (31/10/2026): o formulário da home gravava o e-mail em `leads`
 * sem pedir autorização, sem enviar nada e sem forma de sair da lista. Mandar oferta
 * assim contraria a LGPD e derruba a reputação do domínio (spam).
 *
 * Regras:
 *  - Só entra quem MARCOU a caixa de autorização (nunca vem marcada).
 *  - Dupla confirmação em TODA origem (home, cadastro, compra da aula): a pessoa só vira
 *    "ativa" depois de clicar no link enviado ao e-mail. Nenhum desses formulários prova que
 *    o endereço é de quem digitou (impede cadastrar o e-mail de outra pessoa ou digitar errado).
 *  - Toda mensagem leva link de cancelamento. Cancelar vale na hora e sobrevive a novo
 *    cadastro: quem saiu só volta se pedir de novo e (na home) confirmar de novo.
 *  - Guardamos quando, de onde e com qual versão do texto a pessoa autorizou (prova da LGPD).
 *  - Ninguém é importado sem autorização: lista de clientes antigos não entra aqui.
 *
 * Funções puras no topo (testáveis sem banco); acesso ao banco depois.
 */
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import * as db from "./db";

// ─── Regras puras ───────────────────────────────────────────────────────────

/** Versão do texto que a pessoa viu ao marcar a caixa. Mudou o texto, mude aqui. */
export const TEXTO_CONSENTIMENTO_VERSAO = "2026-10-31";
export const TEXTO_CONSENTIMENTO = "Quero receber novidades, conteúdos e ofertas da Shadia Hasan por e-mail. Posso cancelar quando quiser.";

export const ORIGENS = ["home", "cadastro", "compra-aula", "autoavaliacao"] as const;
export type Origem = (typeof ORIGENS)[number];
export const ROTULO_ORIGEM: Record<Origem, string> = {
  home: "Formulário da home",
  cadastro: "Cadastro no site",
  "compra-aula": "Compra da aula experimental",
  autoavaliacao: "Autoavaliação (anúncios)",
};

/**
 * Todas as origens exigem clicar no link do e-mail. Se um dia houver uma origem que já prova
 * o e-mail por outro caminho, libere aqui (o resto do código já trata o caso sem confirmação).
 */
export function exigeConfirmacaoPorEmail(_origem: Origem): boolean {
  return true;
}

export function normalizarEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  const e = normalizarEmail(email);
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e);
}

export function novoToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Token no formato que geramos (evita consulta ao banco com lixo). */
export function tokenValido(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{32}$/.test(t);
}

export type EstadoContato = { confirmadoEm: Date | null; descadastradoEm: Date | null };

/** Pode receber campanha? Confirmado e sem cancelamento. */
export function contatoAtivo(c: EstadoContato): boolean {
  return !!c.confirmadoEm && !c.descadastradoEm;
}

/** Cooldown entre dois e-mails de confirmação para o mesmo endereço (anti-abuso). */
export const ESPERA_CONFIRMACAO_MS = 10 * 60 * 1000;

export function podeReenviarConfirmacao(ultimoEnvio: Date | null | undefined, agora = new Date()): boolean {
  return !ultimoEnvio || agora.getTime() - ultimoEnvio.getTime() >= ESPERA_CONFIRMACAO_MS;
}

/** Limitador simples em memória (por chave, janela deslizante). */
export function criarLimitador(max: number, janelaMs: number) {
  const marcas = new Map<string, number[]>();
  return (chave: string, agora = Date.now()): boolean => {
    const recentes = (marcas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= max) {
      marcas.set(chave, recentes);
      return false;
    }
    recentes.push(agora);
    marcas.set(chave, recentes);
    if (marcas.size > 5000) marcas.forEach((v, k) => { if (!v.some((t: number) => agora - t < janelaMs)) marcas.delete(k); });
    return true;
  };
}

export function urlSair(base: string, token: string): string {
  return `${base}/api/marketing/sair?t=${encodeURIComponent(token)}`;
}
export function urlConfirmar(base: string, token: string): string {
  return `${base}/api/marketing/confirmar?t=${encodeURIComponent(token)}`;
}

// ─── Tabela ─────────────────────────────────────────────────────────────────

let tabelasProntas: Promise<boolean> | null = null;

export function garantirTabelasMarketing(): Promise<boolean> {
  if (!tabelasProntas) {
    tabelasProntas = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "marketingContatos" (
            "id" serial PRIMARY KEY,
            "email" varchar(320) NOT NULL UNIQUE,
            "nome" varchar(255),
            "origem" varchar(40) NOT NULL,
            "token" varchar(64) NOT NULL UNIQUE,
            "userId" integer,
            "consentimentoEm" timestamptz NOT NULL DEFAULT now(),
            "consentimentoTexto" varchar(40) NOT NULL,
            "confirmadoEm" timestamptz,
            "confirmacaoEnviadaEm" timestamptz,
            "descadastradoEm" timestamptz,
            "criadoEm" timestamptz NOT NULL DEFAULT now()
          )
        `);
        // Perfil da autoavaliação e origem do clique (anúncio). Só informação de campanha, gravada na primeira vez.
        for (const coluna of ["perfil varchar(40)", "utmSource varchar(100)", "utmCampaign varchar(150)", "utmTerm varchar(200)"]) {
          const [nome, tipo] = coluna.split(" ");
          await d.execute(sql.raw(`ALTER TABLE "marketingContatos" ADD COLUMN IF NOT EXISTS "${nome}" ${tipo}`));
        }
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "marketingCampanhas" (
            "id" serial PRIMARY KEY,
            "nome" varchar(160) NOT NULL,
            "assunto" varchar(200) NOT NULL,
            "corpo" text NOT NULL,
            "botaoTexto" varchar(60),
            "botaoUrl" varchar(500),
            "origens" varchar(200) NOT NULL DEFAULT '',
            "semAssinatura" boolean NOT NULL DEFAULT false,
            "status" varchar(20) NOT NULL DEFAULT 'rascunho',
            "criadoPor" integer,
            "criadoEm" timestamptz NOT NULL DEFAULT now(),
            "iniciadoEm" timestamptz,
            "concluidoEm" timestamptz
          )
        `);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "marketingEnvios" (
            "campanhaId" integer NOT NULL,
            "contatoId" integer NOT NULL,
            "email" varchar(320) NOT NULL,
            "status" varchar(20) NOT NULL DEFAULT 'pendente',
            "resendId" varchar(100),
            "erro" text,
            "tentadoEm" timestamptz,
            "enviadoEm" timestamptz,
            PRIMARY KEY ("campanhaId", "contatoId")
          )
        `);
        return true;
      } catch (e) {
        console.warn("[Marketing] tabelas indisponíveis:", e instanceof Error ? e.message : e);
        tabelasProntas = null;
        return false;
      }
    })();
  }
  return tabelasProntas;
}

export const linhasDe = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

// ─── Cadastro, confirmação e cancelamento ───────────────────────────────────

export type ResultadoRegistro = {
  /** Precisa mandar o e-mail "confirme sua inscrição" agora. */
  enviarConfirmacao: boolean;
  /** Já está ativo (nada a fazer). */
  jaAtivo: boolean;
  token: string | null;
};

/**
 * Registra a autorização de uma pessoa. Chamar só depois de a caixa ter sido marcada.
 * Nunca revela ao chamador se o e-mail já existia (a tela responde igual).
 */
export type OrigemDoClique = { perfil?: string | null; utmSource?: string | null; utmCampaign?: string | null; utmTerm?: string | null };

const limpar = (v: string | null | undefined, max: number) => (v ?? "").trim().slice(0, max) || null;

export async function registrarContato(p: { email: string; nome?: string | null; origem: Origem; userId?: number | null } & OrigemDoClique): Promise<ResultadoRegistro> {
  const vazio: ResultadoRegistro = { enviarConfirmacao: false, jaAtivo: false, token: null };
  const email = normalizarEmail(p.email);
  if (!emailValido(email)) return vazio;
  if (!(await garantirTabelasMarketing())) return vazio;
  const d = await db.getDb();
  if (!d) return vazio;

  const nome = (p.nome ?? "").trim().slice(0, 255) || null;
  const dupla = exigeConfirmacaoPorEmail(p.origem);
  const perfil = limpar(p.perfil, 40);
  const utmSource = limpar(p.utmSource, 100);
  const utmCampaign = limpar(p.utmCampaign, 150);
  const utmTerm = limpar(p.utmTerm, 200);

  return await d.transaction(async (tx) => {
    const atual = linhasDe(await tx.execute(sql`SELECT * FROM "marketingContatos" WHERE "email" = ${email} FOR UPDATE`))[0];

    if (!atual) {
      const token = novoToken();
      await tx.execute(sql`
        INSERT INTO "marketingContatos" ("email","nome","origem","token","userId","consentimentoTexto","confirmadoEm","confirmacaoEnviadaEm","perfil","utmSource","utmCampaign","utmTerm")
        VALUES (${email}, ${nome}, ${p.origem}, ${token}, ${p.userId ?? null}, ${TEXTO_CONSENTIMENTO_VERSAO},
                ${dupla ? null : sql`now()`}, ${dupla ? sql`now()` : null}, ${perfil}, ${utmSource}, ${utmCampaign}, ${utmTerm})
      `);
      return { enviarConfirmacao: dupla, jaAtivo: !dupla, token };
    }

    const ativo = contatoAtivo({ confirmadoEm: atual.confirmadoEm, descadastradoEm: atual.descadastradoEm });
    if (ativo) {
      // Já recebe: só completa nome e vínculo com a conta, se faltavam.
      await tx.execute(sql`UPDATE "marketingContatos" SET "nome" = COALESCE("nome", ${nome}), "userId" = COALESCE("userId", ${p.userId ?? null}), "perfil" = COALESCE("perfil", ${perfil}) WHERE "id" = ${atual.id}`);
      return { enviarConfirmacao: false, jaAtivo: true, token: atual.token };
    }

    // Voltou a pedir (era pendente ou tinha cancelado): vale a autorização de agora.
    if (dupla) {
      const podeEnviar = podeReenviarConfirmacao(atual.confirmacaoEnviadaEm ? new Date(atual.confirmacaoEnviadaEm) : null);
      await tx.execute(sql`
        UPDATE "marketingContatos"
        SET "nome" = COALESCE(${nome}, "nome"), "consentimentoEm" = now(), "consentimentoTexto" = ${TEXTO_CONSENTIMENTO_VERSAO},
            "confirmadoEm" = NULL, "origem" = ${p.origem}, "perfil" = COALESCE(${perfil}, "perfil"),
            "utmSource" = COALESCE("utmSource", ${utmSource}), "utmCampaign" = COALESCE("utmCampaign", ${utmCampaign}), "utmTerm" = COALESCE("utmTerm", ${utmTerm}),
            "confirmacaoEnviadaEm" = ${podeEnviar ? sql`now()` : sql`"confirmacaoEnviadaEm"`}
        WHERE "id" = ${atual.id}
      `);
      return { enviarConfirmacao: podeEnviar, jaAtivo: false, token: atual.token };
    }
    await tx.execute(sql`
      UPDATE "marketingContatos"
      SET "nome" = COALESCE(${nome}, "nome"), "consentimentoEm" = now(), "consentimentoTexto" = ${TEXTO_CONSENTIMENTO_VERSAO},
          "confirmadoEm" = now(), "descadastradoEm" = NULL, "origem" = ${p.origem}, "userId" = COALESCE("userId", ${p.userId ?? null})
      WHERE "id" = ${atual.id}
    `);
    return { enviarConfirmacao: false, jaAtivo: true, token: atual.token };
  });
}

export type ContatoPublico = { email: string; nome: string | null; confirmado: boolean; descadastrado: boolean };

export async function contatoPorToken(token: string): Promise<ContatoPublico | null> {
  if (!tokenValido(token) || !(await garantirTabelasMarketing())) return null;
  const d = await db.getDb();
  if (!d) return null;
  const c = linhasDe(await d.execute(sql`SELECT "email","nome","confirmadoEm","descadastradoEm" FROM "marketingContatos" WHERE "token" = ${token}`))[0];
  if (!c) return null;
  return { email: c.email, nome: c.nome, confirmado: !!c.confirmadoEm, descadastrado: !!c.descadastradoEm };
}

/** Confirma a inscrição (link do e-mail). Quem tinha cancelado e pediu de novo volta aqui. */
export async function confirmarContato(token: string): Promise<boolean> {
  if (!tokenValido(token) || !(await garantirTabelasMarketing())) return false;
  const d = await db.getDb();
  if (!d) return false;
  const r = linhasDe(await d.execute(sql`
    UPDATE "marketingContatos"
    SET "confirmadoEm" = COALESCE("confirmadoEm", now()), "descadastradoEm" = NULL
    WHERE "token" = ${token}
    RETURNING "id"
  `));
  return r.length > 0;
}

/** Cancela a inscrição. Idempotente: cancelar duas vezes não muda a data. */
export async function descadastrarContato(token: string): Promise<boolean> {
  if (!tokenValido(token) || !(await garantirTabelasMarketing())) return false;
  const d = await db.getDb();
  if (!d) return false;
  const r = linhasDe(await d.execute(sql`
    UPDATE "marketingContatos" SET "descadastradoEm" = COALESCE("descadastradoEm", now())
    WHERE "token" = ${token}
    RETURNING "id"
  `));
  return r.length > 0;
}

/** Resumo para o painel: quantos ativos, aguardando confirmação e cancelados, e por origem. */
export async function resumoContatos(): Promise<{ ativos: number; pendentes: number; descadastrados: number; porOrigem: { origem: string; ativos: number }[] }> {
  const vazio = { ativos: 0, pendentes: 0, descadastrados: 0, porOrigem: [] };
  if (!(await garantirTabelasMarketing())) return vazio;
  const d = await db.getDb();
  if (!d) return vazio;
  const t = linhasDe(await d.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE "confirmadoEm" IS NOT NULL AND "descadastradoEm" IS NULL)::int AS ativos,
      COUNT(*) FILTER (WHERE "confirmadoEm" IS NULL AND "descadastradoEm" IS NULL)::int AS pendentes,
      COUNT(*) FILTER (WHERE "descadastradoEm" IS NOT NULL)::int AS descadastrados
    FROM "marketingContatos"
  `))[0];
  const o = linhasDe(await d.execute(sql`
    SELECT "origem", COUNT(*)::int AS ativos FROM "marketingContatos"
    WHERE "confirmadoEm" IS NOT NULL AND "descadastradoEm" IS NULL GROUP BY "origem" ORDER BY 2 DESC
  `));
  return { ativos: Number(t.ativos), pendentes: Number(t.pendentes), descadastrados: Number(t.descadastrados), porOrigem: o.map((x) => ({ origem: x.origem, ativos: Number(x.ativos) })) };
}
