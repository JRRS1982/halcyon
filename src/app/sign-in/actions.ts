"use server";

import { signInSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Only forward to in-app paths to prevent open-redirect via `next=https://evil`.
const safeNext = (raw: FormDataEntryValue | null) =>
  typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
    ? raw
    : "/";

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

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
};
