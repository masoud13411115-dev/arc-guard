/**
 * ARC Guard LAN Server Routes
 *
 * Implements the full local-server REST API that localAdapter.ts calls.
 * Uses in-memory Maps per companyId — no external database required.
 * Data is volatile (resets on server restart), suitable for LAN patrol sessions.
 *
 * Mounted at /api by app.ts, so all paths here are relative to /api.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID, createHash } from "crypto";

function hashGuardPin(guardCode: string, pin: string): string {
  return createHash("sha256")
    .update(`arc_guard_lan_v1|${guardCode.toLowerCase()}|${pin}`)
    .digest("hex");
}

const router: IRouter = Router();

// ── Express 5 param helper ────────────────────────────────────────────────────
// req.params values are typed string | string[] in Express 5; always use first string.
const sp = (v: string | string[]): string => (Array.isArray(v) ? v[0] ?? "" : v);

// ── In-memory store ───────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

interface CompanyStore {
  checkpoints: Map<string, AnyRecord>;
  patrolLogs:  Map<string, AnyRecord>;
  sessions:    Map<string, AnyRecord>;
  alerts:      Map<string, AnyRecord>;
  company:     AnyRecord | null;
  guards:      Map<string, AnyRecord>;
  guardAuth:   Map<string, { hash: string; uid: string }>;
}

const stores = new Map<string, CompanyStore>();

function cs(companyId: string): CompanyStore {
  if (!stores.has(companyId)) {
    stores.set(companyId, {
      checkpoints: new Map(),
      patrolLogs:  new Map(),
      sessions:    new Map(),
      alerts:      new Map(),
      guardAuth:   new Map(),
      company:     {
        id:             companyId,
        name:           "شرکت محلی",
        plan:           "professional",
        active:         true,
        suspended:      false,
        inviteCode:     randomUUID().slice(0, 8).toUpperCase(),
        guardCount:     0,
        checkpointCount: 0,
        createdAt:      Date.now(),
        adminUsername:  "admin",
        adminUid:       "local-admin",
      },
      guards: new Map(),
    });
  }
  return stores.get(companyId)!;
}

// ── Health ────────────────────────────────────────────────────────────────────

router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, mode: "lan", ts: Date.now() });
});

// ── Server info (company discovery for guard login) ───────────────────────────
// Must be declared BEFORE /:cid routes so "info" isn't matched as a company ID.

router.get("/info", (_req: Request, res: Response) => {
  const companies = [...stores.values()].map((s) => s.company).filter(Boolean);
  res.json({ companies, serverTime: Date.now() });
});

// ── Checkpoints ───────────────────────────────────────────────────────────────

router.get("/:cid/checkpoints", (req: Request, res: Response) => {
  const list = [...cs(sp(req.params.cid)).checkpoints.values()];
  res.json({ checkpoints: list });
});

router.post("/:cid/checkpoints", (req: Request, res: Response) => {
  const cid  = sp(req.params.cid);
  const id   = (req.body as AnyRecord).id as string | undefined ?? randomUUID();
  const qrCode = `ARCG|${cid}|${id}`;
  const record: AnyRecord = { ...req.body as AnyRecord, id, companyId: cid, qrCode, createdAt: Date.now() };
  cs(cid).checkpoints.set(id, record);
  res.status(201).json({ id });
});

router.patch("/:cid/checkpoints/:id", (req: Request, res: Response) => {
  const cid  = sp(req.params.cid);
  const id   = sp(req.params.id);
  const store = cs(cid).checkpoints;
  const existing = store.get(id);
  if (!existing) { res.status(404).json({ error: "not found" }); return; }
  store.set(id, { ...existing, ...(req.body as AnyRecord), id });
  res.sendStatus(204);
});

router.delete("/:cid/checkpoints/:id", (req: Request, res: Response) => {
  cs(sp(req.params.cid)).checkpoints.delete(sp(req.params.id));
  res.sendStatus(204);
});

// ── Patrol Logs ───────────────────────────────────────────────────────────────

router.get("/:cid/patrol-logs", (req: Request, res: Response) => {
  const cid     = sp(req.params.cid);
  const limit   = parseInt(req.query.limit as string ?? "200", 10);
  const guardId = req.query.guardId as string | undefined;
  let   logs    = [...cs(cid).patrolLogs.values()];
  if (guardId) logs = logs.filter((l) => (l as AnyRecord).guardId === guardId);
  logs.sort((a, b) => ((b.scanTime as number) ?? 0) - ((a.scanTime as number) ?? 0));
  res.json({ logs: logs.slice(0, limit) });
});

router.post("/:cid/patrol-logs", (req: Request, res: Response) => {
  const cid    = sp(req.params.cid);
  const id     = (req.body as AnyRecord).id as string | undefined ?? randomUUID();
  const record: AnyRecord = { ...req.body as AnyRecord, id, companyId: cid };
  cs(cid).patrolLogs.set(id, record);
  res.status(201).json({ id });
});

// ── Guard Sessions ────────────────────────────────────────────────────────────

router.get("/:cid/guard-sessions", (req: Request, res: Response) => {
  res.json({ sessions: [...cs(sp(req.params.cid)).sessions.values()] });
});

router.put("/:cid/guard-sessions/:gid", (req: Request, res: Response) => {
  const cid = sp(req.params.cid);
  const gid = sp(req.params.gid);
  cs(cid).sessions.set(gid, { ...(req.body as AnyRecord), guardId: gid, companyId: cid });
  res.sendStatus(204);
});

// ── Alerts ────────────────────────────────────────────────────────────────────

router.get("/:cid/alerts", (req: Request, res: Response) => {
  const cid   = sp(req.params.cid);
  const limit = parseInt(req.query.limit as string ?? "100", 10);
  const list  = [...cs(cid).alerts.values()];
  list.sort((a, b) => ((b.alertedAt as number) ?? 0) - ((a.alertedAt as number) ?? 0));
  res.json({ alerts: list.slice(0, limit) });
});

router.post("/:cid/alerts", (req: Request, res: Response) => {
  const cid    = sp(req.params.cid);
  const id     = (req.body as AnyRecord).id as string | undefined ?? randomUUID();
  const record: AnyRecord = {
    ...(req.body as AnyRecord),
    id,
    companyId: cid,
    resolved:  false,
    alertedAt: Date.now(),
  };
  cs(cid).alerts.set(id, record);
  res.status(201).json({ id });
});

router.patch("/:cid/alerts/:id/resolve", (req: Request, res: Response) => {
  const cid   = sp(req.params.cid);
  const id    = sp(req.params.id);
  const store = cs(cid).alerts;
  const existing = store.get(id);
  if (existing) store.set(id, { ...existing, resolved: true, resolvedAt: Date.now() });
  res.sendStatus(204);
});

// ── Company ───────────────────────────────────────────────────────────────────

router.get("/:cid/company", (req: Request, res: Response) => {
  res.json({ company: cs(sp(req.params.cid)).company });
});

router.patch("/:cid/company", (req: Request, res: Response) => {
  const s = cs(sp(req.params.cid));
  s.company = { ...s.company, ...(req.body as AnyRecord) };
  res.sendStatus(204);
});

router.post("/:cid/company/invite-code", (req: Request, res: Response) => {
  const s = cs(sp(req.params.cid));
  const inviteCode = randomUUID().slice(0, 8).toUpperCase();
  s.company = { ...s.company, inviteCode };
  res.json({ inviteCode });
});

router.patch("/:cid/company/plan", (req: Request, res: Response) => {
  const s = cs(sp(req.params.cid));
  s.company = { ...s.company, plan: (req.body as AnyRecord).plan };
  res.sendStatus(204);
});

router.patch("/:cid/company/suspended", (req: Request, res: Response) => {
  const s = cs(sp(req.params.cid));
  s.company = { ...s.company, suspended: (req.body as AnyRecord).suspended };
  res.sendStatus(204);
});

// ── Guards ────────────────────────────────────────────────────────────────────

router.get("/:cid/guards", (req: Request, res: Response) => {
  res.json({ guards: [...cs(sp(req.params.cid)).guards.values()] });
});

router.patch("/guards/:uid/active", (req: Request, res: Response) => {
  const uid = sp(req.params.uid);
  for (const [, store] of stores) {
    const g = store.guards.get(uid);
    if (g) {
      store.guards.set(uid, { ...g, active: (req.body as AnyRecord).active });
      break;
    }
  }
  res.sendStatus(204);
});

// ── Guard auth (LAN-local login — no Firebase required) ───────────────────────

/**
 * POST /api/:cid/guards/register
 * Stores the guard's profile + PIN hash so they can login without Firebase.
 * Called automatically by the guard app on first LAN login.
 */
router.post("/:cid/guards/register", (req: Request, res: Response) => {
  const cid = sp(req.params.cid);
  const { guardCode, pin, displayName, companyName } = req.body as AnyRecord;
  if (!guardCode || !pin) {
    res.status(400).json({ error: "guardCode and pin required" });
    return;
  }
  const code = (guardCode as string).toUpperCase();
  const uid  = `guard_${cid}_${code.toLowerCase()}`;
  const hash = hashGuardPin(code, pin as string);
  const profile: AnyRecord = {
    uid,
    guardCode:   code,
    displayName: (displayName as string) ?? code,
    role:        "guard",
    companyId:   cid,
    companyName: (companyName as string) ?? "شرکت محلی",
    active:      true,
    createdAt:   Date.now(),
  };
  const store = cs(cid);
  store.guards.set(uid, profile);
  store.guardAuth.set(code, { hash, uid });
  res.status(201).json({ uid, profile });
});

/**
 * POST /api/:cid/guards/auth
 * Verifies guardCode + PIN → returns profile. 404 if not registered, 401 if wrong PIN.
 */
router.post("/:cid/guards/auth", (req: Request, res: Response) => {
  const cid = sp(req.params.cid);
  const { guardCode, pin } = req.body as AnyRecord;
  if (!guardCode || !pin) {
    res.status(400).json({ error: "guardCode and pin required" });
    return;
  }
  const code  = (guardCode as string).toUpperCase();
  const store = cs(cid);
  const entry = store.guardAuth.get(code);
  if (!entry) { res.status(404).json({ error: "not_registered" }); return; }
  const hash = hashGuardPin(code, pin as string);
  if (hash !== entry.hash) { res.status(401).json({ error: "invalid_pin" }); return; }
  const profile = store.guards.get(entry.uid);
  if (!profile) { res.status(404).json({ error: "profile_missing" }); return; }
  res.json({ uid: entry.uid, profile });
});

// ── Super admin ───────────────────────────────────────────────────────────────

router.get("/admin/companies", (_req: Request, res: Response) => {
  const companies = [...stores.values()].map((s) => s.company).filter(Boolean);
  res.json({ companies });
});

export default router;
