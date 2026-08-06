// src/__tests__/email/send.test.ts
/**
 * @jest-environment node
 */

// The transport reads its config at module scope through emailEnv, so the mock
// has to be in place before the import.
jest.mock("@/lib/env", () => ({
  emailEnv: {
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "Balanced Money <reminders@balanced.money>",
  },
}));

import { isEmailConfigured, sendEmail } from "@/lib/email/send";

const email = {
  to: "someone@example.com",
  subject: "August 2026 is ready to log",
  text: "plain",
  html: "<p>rich</p>",
  unsubscribeUrl: "https://balanced.money/unsubscribe?token=tok",
};

const okResponse = (body: unknown = { id: "msg_1" }) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;

describe("sendEmail", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;

  beforeEach(() => fetchMock.mockReset());

  const bodyOf = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  test("posts the message to Resend with the API key", async () => {
    fetchMock.mockResolvedValue(okResponse());

    const result = await sendEmail(email);

    expect(result).toEqual({ ok: true, id: "msg_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    expect(bodyOf()).toMatchObject({
      from: "Balanced Money <reminders@balanced.money>",
      to: ["someone@example.com"],
      subject: email.subject,
      text: "plain",
      html: "<p>rich</p>",
    });
  });

  // The headers Gmail and Outlook read to render their own unsubscribe control.
  // Getting these wrong doesn't fail a send — it just quietly removes the
  // fastest way out and costs deliverability, which is why they're pinned.
  test("advertises one-click unsubscribe when a URL is given", async () => {
    fetchMock.mockResolvedValue(okResponse());

    await sendEmail(email);

    expect(bodyOf().headers).toEqual({
      "List-Unsubscribe": "<https://balanced.money/unsubscribe?token=tok>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  test("omits the headers when there is no unsubscribe URL", async () => {
    fetchMock.mockResolvedValue(okResponse());

    await sendEmail({ ...email, unsubscribeUrl: undefined });

    expect(bodyOf().headers).toEqual({});
  });

  // A rejected send must be reportable, not thrown: the cron loops over every
  // subscriber, and one bad address must not stop the rest.
  test("returns the provider's reason on a rejection", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"message":"Invalid `to` field"}',
    } as Response);

    const result = await sendEmail(email);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("422") });
  });

  test("returns an error rather than throwing when the network fails", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    await expect(sendEmail(email)).resolves.toEqual({
      ok: false,
      error: "ECONNRESET",
    });
  });

  test("reports configured when a key and a from address are present", () => {
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("sendEmail without configuration", () => {
  test("refuses rather than posting to Resend with no key", async () => {
    jest.resetModules();
    jest.doMock("@/lib/env", () => ({ emailEnv: {} }));
    const unconfigured = await import("@/lib/email/send");

    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(unconfigured.isEmailConfigured()).toBe(false);
    await expect(unconfigured.sendEmail(email)).resolves.toEqual({
      ok: false,
      error: "Email is not configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
