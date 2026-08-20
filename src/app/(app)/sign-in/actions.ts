"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/demo";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";
import { safeNext } from "@/lib/auth/safeNext";
import { signInSchema } from "@/lib/auth/schemas";
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  nextActivity,
  serializeActivity,
} from "@/lib/auth/sessionTimeout";
import { clientIp } from "@/lib/http/clientIp";
import { withinRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

// Starts the session-timeout clock at the moment the session is created.
//
// The proxy stamps this cookie on every request it sees, but it never sees the
// one that matters most: `redirect()` from a server action produces an RSC
// navigation, not a document request, so a freshly signed-in user would carry
// no activity stamp until they happened to trigger a full page load. Until
// then `parseActivity` reads null, which is treated as "no history" — so the
// absolute limit would keep restarting instead of counting down.
const startActivityClock = async () => {
  const jar = await cookies();
  jar.set(
    ACTIVITY_COOKIE,
    serializeActivity(nextActivity(null, Date.now())),
    activityCookieOptions,
  );
};

export const signIn = async (formData: FormData) => {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeNext(formData.get("next"), POST_AUTH_LANDING);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid form submission";
    redirect(`/sign-in?error=${encodeURIComponent(message)}`);
  }

  if (!(await withinRateLimit("sign-in", await clientIp()))) {
    redirect(
      `/sign-in?error=${encodeURIComponent("Too many attempts. Please wait a minute and try again.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  await startActivityClock();
  redirect(next);
};

// Dev-only convenience: one-click sign-in as the seeded demo user. Refuses in
// production (defence-in-depth — the button is also stripped from the prod
// bundle via `demoLoginEnabled`).
export const signInAsDemo = async (formData: FormData) => {
  if (process.env.NODE_ENV === "production") {
    redirect("/sign-in");
  }
  const next = safeNext(formData.get("next"), POST_AUTH_LANDING);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  await startActivityClock();
  redirect(next);
};
