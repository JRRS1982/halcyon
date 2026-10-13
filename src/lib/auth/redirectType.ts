import { z } from "zod";

// `redirectType` tells us which flow opened a PKCE exchange. auth-js reads it
// back from the verifier the browser stored when the flow started — not from a
// query param — so a link cannot assert it, and it is "recovery" only for a
// flow opened by resetPasswordForEmail.
//
// It is read at runtime rather than off the type because auth-js 2.116 returns
// the field (its own JSDoc example response shows `redirectType: null`) while
// declaring exchangeCodeForSession as AuthTokenResponse, which does not carry
// it. A cast would claim a guarantee the package does not make; this parse
// reports what is actually there, and answers false if a later release drops
// the field rather than throwing.
const recoveryResult = z.object({ redirectType: z.literal("recovery") });

export const isRecoveryExchange = (data: unknown): boolean =>
  recoveryResult.safeParse(data).success;
