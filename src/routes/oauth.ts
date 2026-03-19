import { Hono } from "hono";
import { nanoid } from "nanoid";
import { SignJWT } from "jose";

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

interface AuthCodeEntry {
  clientId: string;
  redirectUri: string;
  scope: string;
  createdAt: number;
}

interface RefreshTokenEntry {
  scope: string;
  createdAt: number;
}

/** Auth codes — short-lived (5 min), one-time use */
const authCodes = new Map<string, AuthCodeEntry>();

/** Refresh tokens — long-lived */
const refreshTokens = new Map<string, RefreshTokenEntry>();

// Periodically clean up expired auth codes (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of authCodes) {
    if (now - entry.createdAt > 5 * 60 * 1000) {
      authCodes.delete(code);
    }
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

async function generateAccessToken(scope: string): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.MISTAKES_JWT_SECRET || ""
  );
  return new SignJWT({ scope, type: "oauth" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("oauth-client")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function createOAuthRoutes(): Hono {
  const app = new Hono();

  // GET /authorize — OAuth2 authorization endpoint (auto-approve)
  app.get("/authorize", (c) => {
    const clientId = c.req.query("client_id") || "";
    const redirectUri = c.req.query("redirect_uri") || "";
    const scope = c.req.query("scope") || "";
    const state = c.req.query("state") || "";
    const responseType = c.req.query("response_type") || "";

    const expectedClientId = getEnv("OAUTH_CLIENT_ID", "clawbox");

    if (!clientId || clientId !== expectedClientId) {
      return c.json({ error: "invalid_client", error_description: "Unknown client_id" }, 400);
    }

    if (responseType !== "code") {
      return c.json({ error: "unsupported_response_type", error_description: "Only response_type=code is supported" }, 400);
    }

    if (!redirectUri) {
      return c.json({ error: "invalid_request", error_description: "redirect_uri is required" }, 400);
    }

    // Auto-approve: generate auth code and redirect
    const code = nanoid(32);
    authCodes.set(code, {
      clientId,
      redirectUri,
      scope,
      createdAt: Date.now(),
    });

    const url = new URL(redirectUri);
    url.searchParams.set("code", code);
    if (state) {
      url.searchParams.set("state", state);
    }

    return c.redirect(url.toString(), 302);
  });

  // POST /token — OAuth2 token endpoint
  app.post("/token", async (c) => {
    // Support both form-urlencoded and JSON bodies
    const contentType = c.req.header("Content-Type") || "";
    let body: Record<string, string>;
    if (contentType.includes("application/json")) {
      body = await c.req.json();
    } else {
      const formData = await c.req.parseBody();
      body = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, String(v)])
      );
    }

    const grantType = body.grant_type || "";
    const clientId = body.client_id || "";
    const clientSecret = body.client_secret || "";

    const expectedClientId = getEnv("OAUTH_CLIENT_ID", "clawbox");
    const expectedClientSecret = getEnv("OAUTH_CLIENT_SECRET", "");

    // Validate client credentials
    if (clientId !== expectedClientId) {
      return c.json({ error: "invalid_client", error_description: "Invalid client_id" }, 401);
    }
    if (!expectedClientSecret || clientSecret !== expectedClientSecret) {
      return c.json({ error: "invalid_client", error_description: "Invalid client_secret" }, 401);
    }

    // --- authorization_code grant ---
    if (grantType === "authorization_code") {
      const code = body.code || "";
      const entry = authCodes.get(code);

      if (!entry) {
        return c.json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" }, 400);
      }

      // Validate expiry (5 minutes)
      if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
        authCodes.delete(code);
        return c.json({ error: "invalid_grant", error_description: "Authorization code expired" }, 400);
      }

      // Validate client_id matches
      if (entry.clientId !== clientId) {
        authCodes.delete(code);
        return c.json({ error: "invalid_grant", error_description: "Authorization code was issued to a different client" }, 400);
      }

      // Delete used code (one-time use)
      authCodes.delete(code);

      // Generate tokens
      const accessToken = await generateAccessToken(entry.scope);
      const refreshToken = nanoid(64);

      refreshTokens.set(refreshToken, {
        scope: entry.scope,
        createdAt: Date.now(),
      });

      return c.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
        expires_in: 2592000, // 30 days
        scope: entry.scope,
      });
    }

    // --- refresh_token grant ---
    if (grantType === "refresh_token") {
      const refreshToken = body.refresh_token || "";
      const entry = refreshTokens.get(refreshToken);

      if (!entry) {
        return c.json({ error: "invalid_grant", error_description: "Invalid refresh token" }, 400);
      }

      // Issue new access token (keep the same refresh token)
      const accessToken = await generateAccessToken(entry.scope);

      return c.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
        expires_in: 2592000, // 30 days
        scope: entry.scope,
      });
    }

    return c.json({ error: "unsupported_grant_type", error_description: "Only authorization_code and refresh_token are supported" }, 400);
  });

  return app;
}
