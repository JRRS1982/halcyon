"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { unsubscribeByToken } from "@/lib/email/subscriptions";

/**
 * The visible unsubscribe, from the button on /unsubscribe.
 *
 * A POST rather than acting on the GET that opened the page: mail clients,
 * corporate link scanners and browser prefetchers all fetch URLs in an email
 * without a human deciding to, and a GET that mutates would unsubscribe people
 * who only received the message. The page shows what will happen; this commits
 * it.
 */
export async function confirmUnsubscribe(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const outcome = await unsubscribeByToken(token);

  revalidatePath("/settings");
  redirect(`/unsubscribe?token=${encodeURIComponent(token)}&done=${outcome}`);
}
