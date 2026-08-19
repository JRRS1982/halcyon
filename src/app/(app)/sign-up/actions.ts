"use server";

import { signUpSchema } from "@/lib/auth/schemas";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { withinRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const signUp = async (formData: FormData) => {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid form submission";
    redirect(`/sign-up?error=${encodeURIComponent(message)}`);
  }

  if (!(await withinRateLimit("sign-up", await clientIp()))) {
    redirect(
      `/sign-up?error=${encodeURIComponent("Too many attempts. Please wait a minute and try again.")}`,
    );
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  // Never surface the provider's message to the client: for an address that
  // already has an account Supabase returns "User already registered", which
  // turns sign-up into an email-enumeration oracle. Log it server-side for
  // observability and always land on the same "check your email" page, so an
  // existing address and a new one are indistinguishable from the outside.
  if (error) {
    log.warn("Sign-up did not create a session", { err: error });
  }

  redirect("/sign-up?success=1");
};
