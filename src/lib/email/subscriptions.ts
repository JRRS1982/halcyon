import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { ReminderSubscription } from "./reminder";

/**
 * The database side of the monthly reminder: who is subscribed, and how they
 * stop being subscribed.
 */

/**
 * Every enabled subscription, for isReminderDue() to filter.
 *
 * Deliberately not narrowed by day in SQL: that would duplicate the schedule
 * rule across a query and a pure function, and the two would drift the moment
 * one of them learned about the retry window. One row per user with a boolean
 * index-friendly filter is a cheap read, and the tested function stays the only
 * thing that decides who gets mail.
 */
export async function enabledSubscriptions(): Promise<ReminderSubscription[]> {
  return prisma.userSettings.findMany({
    where: { monthlyReminderEnabled: true },
    select: {
      userId: true,
      monthlyReminderEnabled: true,
      monthlyReminderDay: true,
      monthlyReminderSentAt: true,
      unsubscribeToken: true,
      transactionsEnabled: true,
    },
  });
}

/**
 * 256 bits from the platform CSPRNG, base64url so it survives a URL untouched.
 *
 * This token is the only credential an unsubscribe link carries, and the link
 * travels through an inbox — so it has to be unguessable, but it is also only
 * ever worth one thing: turning someone's own reminder off.
 */
export function newUnsubscribeToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Ensures the row has a token, returning it. Called when the reminder is turned
 * on, so the token exists before any email could reference it.
 */
export async function ensureUnsubscribeToken(userId: string): Promise<string> {
  const existing = await prisma.userSettings.findUnique({
    where: { userId },
    select: { unsubscribeToken: true },
  });
  if (existing?.unsubscribeToken) return existing.unsubscribeToken;

  const token = newUnsubscribeToken();
  await prisma.userSettings.update({
    where: { userId },
    data: { unsubscribeToken: token },
  });
  return token;
}

/**
 * Whether a token matches anyone — a read, safe to run on a GET.
 *
 * The unsubscribe page uses this to decide what to show before anyone presses
 * anything. Without it a mangled or expired link rendered a confirm button that
 * only admitted the link was dead after it had been pressed, which is a
 * confusing way to treat someone who is trying to leave.
 */
export async function unsubscribeTokenExists(token: string): Promise<boolean> {
  if (!token) return false;

  const row = await prisma.userSettings.findUnique({
    where: { unsubscribeToken: token },
    select: { userId: true },
  });
  return Boolean(row);
}

export type UnsubscribeOutcome = "unsubscribed" | "already-off" | "unknown";

/**
 * Turns the reminder off for whoever holds this token.
 *
 * The token is not rotated on use: someone who unsubscribes and later re-enables
 * from Settings keeps the same link, and clicking a stale link from an old email
 * a second time reports "already off" rather than an error. Distinguishing that
 * from an unrecognised token matters for the page's wording — "you're
 * unsubscribed" is reassuring, "we don't know that link" is not, and showing the
 * wrong one sends people looking for a problem.
 */
export async function unsubscribeByToken(
  token: string,
): Promise<UnsubscribeOutcome> {
  if (!token) return "unknown";

  const row = await prisma.userSettings.findUnique({
    where: { unsubscribeToken: token },
    select: { userId: true, monthlyReminderEnabled: true },
  });
  if (!row) return "unknown";
  if (!row.monthlyReminderEnabled) return "already-off";

  await prisma.userSettings.update({
    where: { userId: row.userId },
    data: { monthlyReminderEnabled: false },
  });
  return "unsubscribed";
}

/** Stamps a successful send, so the same month can't go out twice. */
export async function markReminderSent(
  userId: string,
  sentAt: Date,
): Promise<void> {
  await prisma.userSettings.update({
    where: { userId },
    data: { monthlyReminderSentAt: sentAt },
  });
}
