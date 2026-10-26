// Mock Supabase Auth server for Playwright E2E tests.
//
// Implements just enough of /auth/v1/* to drive the auth flow end-to-end
// without hitting real Supabase. In-memory state — reset on every server
// start, fully isolated from any real project.
//
// Run standalone:  node tests/e2e/_mock/supabase.mjs
// Playwright starts it automatically via webServer config.

import { randomUUID } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);

// In-memory user store. Pre-seeded with a known test user so sign-in tests
// don't have to run sign-up first.
const users = new Map();
users.set("test@example.com", {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  password: "e2e-password-123",
  confirmed: true,
});

// A second account, for the one spec that changes a password. The store is
// in-memory and shared by every spec in the run, so changing the known user's
// password would sign out every test that ran after it.
users.set("rotate@example.com", {
  id: "00000000-0000-0000-0000-000000000002",
  email: "rotate@example.com",
  password: "e2e-rotate-123456",
  confirmed: true,
});

// A third, for the password-reset spec, for the same reason as the second.
users.set("reset@example.com", {
  id: "00000000-0000-0000-0000-000000000003",
  email: "reset@example.com",
  password: "e2e-reset-1234567",
  confirmed: true,
});

// Recovery tokens issued by /recover and not yet spent by /verify. Real ones
// are random; these are `recovery_<userId>` so a spec can build the link the
// email would carry without reading a mailbox.
const recoveryTokens = new Map();

const now = () => new Date().toISOString();
const expiresAt = () => Math.floor(Date.now() / 1000) + 3600;

const buildUser = (u) => ({
  id: u.id,
  aud: "authenticated",
  role: "authenticated",
  email: u.email,
  email_confirmed_at: u.confirmed ? now() : null,
  confirmed_at: u.confirmed ? now() : null,
  phone: "",
  last_sign_in_at: now(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  // Every mock user is created with a password, so it carries the email
  // identity a real one would. The app reads this to decide whether to ask for
  // a password or mail a one-time code (src/lib/auth/reauth.ts); an empty array
  // would make every e2e account look like a Google-only sign-in.
  identities: [
    {
      id: u.id,
      user_id: u.id,
      provider: "email",
      identity_data: { email: u.email, sub: u.id },
    },
  ],
  created_at: now(),
  updated_at: now(),
});

const buildSession = (u) => ({
  access_token: `access_${u.id}`,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: expiresAt(),
  refresh_token: `refresh_${u.id}`,
  user: buildUser(u),
});

const readJson = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString();
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const findUserByToken = (token) => {
  // We mint tokens as `access_<userId>` and `refresh_<userId>` so we can recover
  // the user from either form trivially.
  const id = token.replace(/^(access|refresh)_/, "");
  return [...users.values()].find((u) => u.id === id);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const log = (msg) =>
    console.log(`[mock] ${req.method} ${url.pathname}${url.search} → ${msg}`);

  try {
    // Health check — used by Playwright's webServer readiness probe.
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    // GET /range/:prefix — Have I Been Pwned's k-anonymity endpoint, which
    // src/lib/auth/breachedPassword.ts consults on sign-up. Served here so the
    // suite stays hermetic: a live call would make every sign-up test depend on
    // a third party's uptime and latency. The empty body means "no match", so
    // any password the specs use is treated as un-breached.
    if (req.method === "GET" && url.pathname.startsWith("/range/")) {
      // SHA-1("Breached-E2E-Password-1") split the way the range API does:
      // the client sends the first five hex characters and matches the rest
      // locally. Only that one prefix reports a hit, so every other password
      // the specs use reads as un-breached.
      const BREACHED_PREFIX = "72C88";
      const BREACHED_SUFFIX = "0FBFDD961CCBC7896E2785EC362DBF3AE5C";
      const prefix = url.pathname.slice("/range/".length).toUpperCase();
      const body = prefix === BREACHED_PREFIX ? `${BREACHED_SUFFIX}:4242` : "";
      log(body ? "breach match" : "no breach match");
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(body);
    }

    // POST /auth/v1/signup
    if (req.method === "POST" && url.pathname === "/auth/v1/signup") {
      const body = await readJson(req);
      const { email, password } = body;
      if (!email || !password) {
        log("400 (missing fields)");
        return json(res, 400, {
          code: 400,
          msg: "Email and password required",
        });
      }
      const existing = users.get(email);
      const id = existing?.id ?? randomUUID();
      users.set(email, { id, email, password, confirmed: false });
      log(`200 (signup ${email})`);
      // Email confirmation required → session is null until user clicks the
      // confirmation link. Tests assert the "check your email" UI from this.
      return json(res, 200, {
        user: buildUser({ id, email, password, confirmed: false }),
        session: null,
      });
    }

    // POST /auth/v1/token?grant_type=password|refresh_token|pkce
    if (req.method === "POST" && url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      const body = await readJson(req);

      if (grant === "password") {
        const u = users.get(body.email);
        if (!u || u.password !== body.password) {
          log("400 (invalid_grant)");
          return json(res, 400, {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          });
        }
        u.confirmed = true; // Auto-confirm on first successful sign-in.
        log(`200 (signed in ${u.email})`);
        return json(res, 200, buildSession(u));
      }

      if (grant === "refresh_token") {
        const u = findUserByToken(body.refresh_token ?? "");
        if (!u) {
          log("400 (bad refresh token)");
          return json(res, 400, {
            error: "invalid_grant",
            error_description: "Invalid refresh token",
          });
        }
        log(`200 (refreshed ${u.email})`);
        return json(res, 200, buildSession(u));
      }

      if (grant === "pkce") {
        // Code exchange after email confirmation / OAuth. For tests we just
        // return a session for the first registered user.
        const u = [...users.values()][0];
        if (!u) {
          log("400 (no users for code exchange)");
          return json(res, 400, { error: "invalid_request" });
        }
        log(`200 (pkce exchange → ${u.email})`);
        return json(res, 200, buildSession(u));
      }

      log("400 (unsupported grant_type)");
      return json(res, 400, { error: "unsupported_grant_type" });
    }

    // POST /auth/v1/recover — resetPasswordForEmail. Answers 200 whether or
    // not the address has an account, as the real one does.
    if (req.method === "POST" && url.pathname === "/auth/v1/recover") {
      const body = await readJson(req);
      const u = users.get(body.email);
      if (u) recoveryTokens.set(`recovery_${u.id}`, u.email);
      log(`200 (recover ${body.email}${u ? "" : ", no such user"})`);
      return json(res, 200, {});
    }

    // POST /auth/v1/verify — verifyOtp with a recovery token_hash. One use per
    // token, so the spec can show a spent link is refused.
    if (req.method === "POST" && url.pathname === "/auth/v1/verify") {
      const body = await readJson(req);
      const email = recoveryTokens.get(body.token_hash ?? "");
      if (body.type !== "recovery" || !email) {
        log("403 (otp_expired)");
        return json(res, 403, {
          code: 403,
          error_code: "otp_expired",
          msg: "Token has expired or is invalid",
        });
      }
      recoveryTokens.delete(body.token_hash);
      const u = users.get(email);
      log(`200 (recovery verified ${email})`);
      return json(res, 200, buildSession(u));
    }

    // GET /auth/v1/user — current user from Bearer token.
    if (req.method === "GET" && url.pathname === "/auth/v1/user") {
      const auth = req.headers.authorization ?? "";
      const apikey = req.headers.apikey ?? "";
      if (!auth.startsWith("Bearer ")) {
        log("401 (no bearer)");
        return json(res, 401, { code: 401, msg: "Unauthorized" });
      }
      const token = auth.slice("Bearer ".length);
      // The Bearer is the publishable key when no session is present
      // (anonymous lookup). In that case there is no user.
      if (token === apikey) {
        log("401 (anonymous)");
        return json(res, 401, { code: 401, msg: "No user session" });
      }
      const u = findUserByToken(token);
      if (!u) {
        log("401 (unknown user)");
        return json(res, 401, { code: 401, msg: "User not found" });
      }
      log(`200 (user ${u.email})`);
      return json(res, 200, buildUser(u));
    }

    // PUT /auth/v1/user — updateUser. The settings panel changes a password
    // through this, and the stored password has to actually move: the spec
    // signs in again with the new one, which is the only way to tell a real
    // change from a 200 that did nothing.
    if (req.method === "PUT" && url.pathname === "/auth/v1/user") {
      const auth = req.headers.authorization ?? "";
      const u = findUserByToken(auth.replace("Bearer ", ""));
      if (!u) {
        log("401 (unknown user)");
        return json(res, 401, { code: 401, msg: "User not found" });
      }
      const body = await readJson(req);
      if (body.password) u.password = body.password;
      log(`200 (updated ${u.email})`);
      return json(res, 200, buildUser(u));
    }

    // POST /auth/v1/logout
    if (req.method === "POST" && url.pathname === "/auth/v1/logout") {
      log("204 (signed out)");
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /auth/v1/authorize?provider=… — OAuth start. We don't really do
    // OAuth in tests; redirect straight back as if the provider succeeded.
    if (req.method === "GET" && url.pathname === "/auth/v1/authorize") {
      const redirectTo = url.searchParams.get("redirect_to") ?? "/";
      log(`302 → ${redirectTo}`);
      res.writeHead(302, { Location: `${redirectTo}?code=fake_oauth_code` });
      res.end();
      return;
    }

    log("404 (unhandled)");
    json(res, 404, { code: 404, msg: "Not found in mock" });
  } catch (e) {
    console.error("[mock] error:", e);
    json(res, 500, { code: 500, msg: "Mock server error", error: String(e) });
  }
});

server.listen(PORT, () => {
  console.log(`Mock Supabase server listening on http://localhost:${PORT}`);
});
