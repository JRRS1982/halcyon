/**
 * @jest-environment node
 */
const unsubscribeByToken = jest.fn(async (_token: string) => "unsubscribed");

// The real limiter, over an in-memory Redis: see fakeRateLimitStore.
jest.mock("@/lib/rateLimit/redis", () =>
  jest.requireActual("@test/support/fakeRateLimitStore"),
);
jest.mock("@/lib/http/clientIp", () => ({ clientIp: async () => "1.2.3.4" }));
jest.mock("@/lib/email/subscriptions", () => ({
  unsubscribeByToken: (token: string) => unsubscribeByToken(token),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

import {
  chargesTo,
  exhaust,
  resetStore,
} from "@test/support/fakeRateLimitStore";
import { confirmUnsubscribe } from "@/app/(app)/unsubscribe/actions";

const submit = (token: string) => {
  const form = new FormData();
  form.set("token", token);
  return confirmUnsubscribe(form);
};

describe("confirmUnsubscribe", () => {
  beforeEach(() => {
    resetStore();
    unsubscribeByToken.mockClear();
  });

  it("unsubscribes and reports the outcome when allowed", async () => {
    await expect(submit("tok-1")).rejects.toThrow("done=unsubscribed");
    expect(unsubscribeByToken).toHaveBeenCalledWith("tok-1");
  });

  // Limiting POST /api/unsubscribe but not this left the control reading as
  // protection it did not provide: the action was reachable directly, one
  // unauthenticated DB round trip per request.
  it("shares the unsubscribe bucket, keyed on client IP", async () => {
    await expect(submit("tok-1")).rejects.toThrow(/done=/);
    expect(chargesTo("unsubscribe", "1.2.3.4")).toBe(1);
  });

  // Never a silent no-op: opting out is a right, so a limited request is told
  // to come back rather than being quietly dropped.
  it("tells the reader to retry when limited, and touches no data", async () => {
    exhaust("unsubscribe");

    await expect(submit("tok-1")).rejects.toThrow("done=busy");
    expect(unsubscribeByToken).not.toHaveBeenCalled();
  });

  // The token is echoed back so the retry link still works.
  it("keeps the token on the limited redirect", async () => {
    exhaust("unsubscribe");
    await expect(submit("tok with spaces")).rejects.toThrow(
      "token=tok%20with%20spaces",
    );
  });
});
