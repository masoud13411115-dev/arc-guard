/**
 * notify.ts — FCM push notification endpoint for ARC Guard.
 *
 * POST /api/:companyId/notify
 *
 * Sends an FCM push notification to one or more device tokens on behalf of
 * a company.  Requires FIREBASE_SERVICE_ACCOUNT_JSON to be set as an
 * environment variable (base64-encoded or raw JSON string).
 *
 * Without the env var the endpoint returns 501 with a setup guide.
 *
 * Setup:
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" → download JSON
 *   3. Base64-encode it:  base64 -w0 service-account.json
 *   4. Set FIREBASE_SERVICE_ACCOUNT_JSON=<base64-output> in your server env
 *
 * FCM HTTP v1 API reference:
 *   https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send
 */

import { Router } from "express";
import { createSign } from "crypto";

const router = Router();

// ── JWT / service account helpers ─────────────────────────────────────────

interface ServiceAccount {
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const decoded = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf-8");
    return JSON.parse(decoded) as ServiceAccount;
  } catch {
    return null;
  }
}

/** Create a signed JWT for the FCM OAuth2 access-token request. */
function makeJwt(sa: ServiceAccount): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    }),
  ).toString("base64url");

  const unsigned = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const sig = sign.sign(sa.private_key, "base64url");
  return `${unsigned}.${sig}`;
}

/** Exchange a JWT for a short-lived OAuth2 access token. */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const jwt = makeJwt(sa);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`OAuth2 token error: ${data.error ?? "unknown"}`);
  }
  return data.access_token;
}

// ── FCM sender ────────────────────────────────────────────────────────────

interface FcmMessage {
  title: string;
  body: string;
  /** Alert type for client-side routing (sos | missed_checkpoint | info) */
  alertType?: string;
  data?: Record<string, string>;
}

interface SendResult {
  token: string;
  success: boolean;
  error?: string;
}

async function sendFcmToTokens(
  projectId: string,
  accessToken: string,
  tokens: string[],
  message: FcmMessage,
): Promise<SendResult[]> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const results: SendResult[] = [];

  for (const token of tokens) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: message.title, body: message.body },
            data: {
              alertType: message.alertType ?? "info",
              ...message.data,
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "arc-guard-alerts",
                priority: "max",
                default_vibrate_timings: true,
                default_light_settings: true,
              },
            },
          },
        }),
      });

      if (res.ok) {
        results.push({ token, success: true });
      } else {
        const err = (await res.json()) as { error?: { message?: string } };
        results.push({
          token,
          success: false,
          error: err?.error?.message ?? `HTTP ${res.status}`,
        });
      }
    } catch (e) {
      results.push({ token, success: false, error: String(e) });
    }
  }

  return results;
}

// ── Route ─────────────────────────────────────────────────────────────────

/**
 * POST /api/:companyId/notify
 * Body: { title: string, body: string, tokens: string[], alertType?: string }
 */
router.post("/:companyId/notify", async (req, res) => {
  const sa = loadServiceAccount();

  if (!sa) {
    res.status(501).json({
      ok: false,
      error: "FIREBASE_SERVICE_ACCOUNT_JSON not configured",
      setup: [
        "1. Firebase Console → Project Settings → Service Accounts",
        "2. Generate new private key → download JSON",
        "3. base64 -w0 service-account.json",
        "4. Set FIREBASE_SERVICE_ACCOUNT_JSON=<output> in server environment",
      ],
    });
    return;
  }

  const { title, body, tokens, alertType, data } = req.body as {
    title?: string;
    body?: string;
    tokens?: string[];
    alertType?: string;
    data?: Record<string, string>;
  };

  if (!title || !body || !Array.isArray(tokens) || tokens.length === 0) {
    res.status(400).json({
      ok: false,
      error: "Required: title (string), body (string), tokens (string[])",
    });
    return;
  }

  try {
    const accessToken = await getAccessToken(sa);
    const results = await sendFcmToTokens(sa.project_id, accessToken, tokens, {
      title,
      body,
      alertType,
      data,
    });

    const succeeded = results.filter(r => r.success).length;
    const failed    = results.filter(r => !r.success).length;

    res.json({
      ok: true,
      sent: succeeded,
      failed,
      results,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;
