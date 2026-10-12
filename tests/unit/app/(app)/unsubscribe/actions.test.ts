/**
 * @jest-environment node
 */
const checkRateLimit = jest.fn(async () => "allowed");
const unsubscribeByToken = jest.fn(async () => "unsubscribed");

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (action: string, subject: string) =>
    checkRateLimit(action, subject),
}));
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

import { confirmUnsubscribe } from "@/app/(app)/unsubscribe/actions";

const submit = (token: string) => {
  const form = new FormData();
  form.set("token", token);
  return confirmUnsubscribe(form);
};

describe("confirmUnsubscribe", () => {
  beforeEach(() => {
    checkRateLimit.mockClear();
    unsubscribeByToken.mockClear();
    checkRateLimit.mockResolvedValue("allowed" as never);
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
    expect(checkRateLimit).toHaveBeenCalledWith("unsubscribe", "1.2.3.4");
  });

  // Never a silent no-op: opting out is a right, so a limited request is told
  // to come back rather than being quietly dropped.
  it("tells the reader to retry when limited, and touches no data", async () => {
    checkRateLimit.mockResolvedValue("limited" as never);

    await expect(submit("tok-1")).rejects.toThrow("done=busy");
    expect(unsubscribeByToken).not.toHaveBeenCalled();
  });

  // The token is echoed back so the retry link still works.
  it("keeps the token on the limited redirect", async () => {
    checkRateLimit.mockResolvedValue("limited" as never);
    await expect(submit("tok with spaces")).rejects.toThrow(
      "token=tok%20with%20spaces",
    );
  });
});
