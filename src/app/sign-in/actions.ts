"use server";

import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/demo";
import { safeNext } from "@/lib/auth/safeNext";
import { signInSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const signIn = async (formData: FormData) => {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeNext(formData.get("next"));

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid form submission";
    redirect(`/sign-in?error=${encodeURIComponent(message)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
};

// Dev-only convenience: one-click sign-in as the seeded demo user. Refuses in
// production (defence-in-depth — the button is also stripped from the prod
// bundle via `demoLoginEnabled`).
export const signInAsDemo = async (formData: FormData) => {
  if (process.env.NODE_ENV === "production") {
    redirect("/sign-in");
  }
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
};
