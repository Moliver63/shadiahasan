/**
 * profile.ts — Router tRPC para ações do perfil do usuário
 * Localização: server/routers/profile.ts
 *
 * Após criar este arquivo, registre no seu appRouter (index.ts dos routers):
 *
 *   import { profileRouter } from "./profile";
 *
 *   export const appRouter = router({
 *     ...
 *     profile: profileRouter,   // ← adicionar esta linha
 *   });
 *
 * No frontend, as chamadas ficam:
 *   trpc.profile.uploadAvatar.useMutation()
 *   trpc.profile.changePassword.useMutation()
 *   trpc.profile.resendVerification.useMutation()
 */

import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";

export const profileRouter = router({

  // ── Upload de avatar ────────────────────────────────────────
  // Recebe a imagem em base64 do front-end.
  // PRODUÇÃO: substitua o bloco "OPÇÃO A" por upload para S3/Cloudinary.
  uploadAvatar: protectedProcedure
    .input(z.object({
      base64: z.string().min(1),   // "data:image/png;base64,..."
      mimeType: z.enum([
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ]),
    }))
    .mutation(async ({ input, ctx }) => {
      // Valida tamanho (~2MB em base64 ≈ 2.7MB de string)
      if (input.base64.length > 3_600_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Imagem muito grande. Máximo 2MB.",
        });
      }

      // OPÇÃO A: salva base64 direto no banco (simples, ok para começar)
      await db.updateUserAvatar(ctx.user.id, input.base64);

      // OPÇÃO B: upload para S3/Cloudinary (recomendado em produção)
      // const url = await uploadToStorage(input.base64, input.mimeType, ctx.user.id);
      // await db.updateUserAvatar(ctx.user.id, url);

      return { success: true };
    }),

  // ── Alterar senha ───────────────────────────────────────────
  // Exige senha atual para confirmar identidade.
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1, "Digite a senha atual"),
      newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres"),
    }))
    .mutation(async ({ input, ctx }) => {
      // updateOwnPassword verifica a senha atual e lança erro se incorreta
      await db.updateOwnPassword(
        ctx.user.id,
        input.currentPassword,
        input.newPassword,
      );

      return { success: true };
    }),

  // ── Reenviar verificação de email ───────────────────────────
  // Gera novo token e envia e-mail de confirmação.
  resendVerification: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db.resendVerificationEmail(ctx.user.id);
      return { success: true };
    }),

});