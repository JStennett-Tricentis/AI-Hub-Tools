import { Router } from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";

const router = Router();

// ── Config ──────────────────────────────────────────────────────────

const DATA_ROOT = join(process.cwd(), "data", "jwt");

interface TenantConfig {
  environments: Record<string, { keyFile: string; passphraseEnvVar: string }>;
  defaults: { iss: string; roles: string; uid: string; expirySeconds: number };
  tenants: Tenant[];
}

interface Tenant {
  name: string;
  environment: string;
  sub: string;
  aid: string;
  l2cid: string;
  roles?: string;
  _comment?: string;
}

const config: TenantConfig = JSON.parse(
  readFileSync(join(DATA_ROOT, "tenants.json"), "utf-8")
);

const environments = config.environments;
const defaults = config.defaults;
const tenants = config.tenants.filter((t) => !t._comment);

function getEnvironmentNames(): string[] {
  return Object.keys(environments);
}

function getTenantsByEnv(env: string): Tenant[] {
  return tenants.filter((t) => t.environment === env);
}

function readKeyFile(env: string): string {
  const envConfig = environments[env];
  if (!envConfig) throw new Error(`Unknown environment: ${env}`);
  return readFileSync(join(DATA_ROOT, envConfig.keyFile), "utf-8");
}

function buildPayload(tenant: Tenant, customExpiryHours: number | null) {
  const now = Math.floor(Date.now() / 1000);
  const expiry =
    customExpiryHours != null
      ? customExpiryHours * 3600
      : defaults.expirySeconds;

  return {
    iss: defaults.iss,
    sub: tenant.sub,
    aid: tenant.aid,
    l2cid: tenant.l2cid,
    roles: tenant.roles || defaults.roles,
    uid: defaults.uid,
    nbf: now,
    exp: now + expiry,
    iat: now,
  };
}

// ── Token / Passphrase ──────────────────────────────────────────────

const passphraseCache = new Map<string, string>();

function setPassphrase(
  env: string,
  passphrase: string
): { success: boolean; error?: string } {
  try {
    const pem = readKeyFile(env);
    crypto.createPrivateKey({ key: pem, passphrase });
    passphraseCache.set(env, passphrase);
    return { success: true };
  } catch {
    return { success: false, error: "Wrong passphrase \u2014 decryption failed" };
  }
}

function getPassphraseStatus(
  envNames: string[]
): Record<string, boolean> {
  const cached: Record<string, boolean> = {};
  for (const env of envNames) {
    cached[env] = passphraseCache.has(env);
  }
  return cached;
}

function hasPassphrase(env: string): boolean {
  return passphraseCache.has(env);
}

async function signToken(env: string, payload: object): Promise<string> {
  const passphrase = passphraseCache.get(env);
  if (!passphrase) throw new Error(`Passphrase not set for ${env}`);

  const pem = readKeyFile(env);
  const keyObject = crypto.createPrivateKey({ key: pem, passphrase });
  const unencryptedPem = keyObject.export({
    type: "pkcs8",
    format: "pem",
  }) as string;

  const privateKey = await importPKCS8(unencryptedPem, "RS256");

  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(privateKey);
}

function decodeToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  try {
    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString()
    );
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString()
    );
    return { header, payload };
  } catch {
    throw new Error("Invalid JWT format");
  }
}

function humanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 31536000) return `${Math.floor(seconds / 86400)}d`;
  return `${(seconds / 31536000).toFixed(1)}y`;
}

function computeExpiryStatus(payload: {
  exp?: number;
}): { expired: boolean; remaining: string } {
  if (payload.exp == null) {
    return { expired: false, remaining: "no expiry" };
  }

  const now = Math.floor(Date.now() / 1000);
  const diff = payload.exp - now;

  if (diff <= 0) {
    return { expired: true, remaining: "0s" };
  }

  return { expired: false, remaining: humanDuration(diff) };
}

// ── Routes (all under /api/jwt) ─────────────────────────────────────

router.get("/jwt/environments", (_req, res) => {
  res.json({ environments: getEnvironmentNames() });
});

router.get("/jwt/tenants", (req, res): void => {
  const env = req.query.env as string | undefined;
  if (!env) {
    res.status(400).json({ error: "Missing env query parameter" });
    return;
  }
  if (!environments[env]) {
    res.status(400).json({ error: `Unknown environment: ${env}` });
    return;
  }
  const tenantList = getTenantsByEnv(env).map((t) => ({
    name: t.name,
    aid: t.aid,
    environment: t.environment,
    sub: t.sub,
    l2cid: t.l2cid,
    ...(t.roles ? { roles: t.roles } : {}),
  }));
  res.json({ tenants: tenantList });
});

router.post("/jwt/passphrase", (req, res): void => {
  const { environment, passphrase } = req.body;
  if (!environment || !passphrase) {
    res.status(400).json({ error: "Missing environment or passphrase" });
    return;
  }
  if (!environments[environment]) {
    res.status(400).json({ error: `Unknown environment: ${environment}` });
    return;
  }
  const result = setPassphrase(environment, passphrase);
  res.json(result);
});

router.get("/jwt/passphrase/status", (_req, res) => {
  res.json({ cached: getPassphraseStatus(getEnvironmentNames()) });
});

router.post("/jwt/generate", async (req, res): Promise<void> => {
  try {
    const { environment, tenantIndex, customExpiryHours } = req.body;
    if (!environment) {
      res.status(400).json({ error: "Missing environment" });
      return;
    }
    if (!hasPassphrase(environment)) {
      res.status(400).json({ error: `Passphrase not set for ${environment}` });
      return;
    }

    const tenantList = getTenantsByEnv(environment);
    if (
      tenantIndex == null ||
      tenantIndex < 0 ||
      tenantIndex >= tenantList.length
    ) {
      res.status(400).json({ error: "Invalid tenant index" });
      return;
    }

    const tenant = tenantList[tenantIndex];
    const payload = buildPayload(tenant, customExpiryHours ?? null);
    const token = await signToken(environment, payload);

    res.json({ token, payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/jwt/bulk-generate", async (req, res): Promise<void> => {
  try {
    const { environment } = req.body;
    if (!environment) {
      res.status(400).json({ error: "Missing environment" });
      return;
    }
    if (!hasPassphrase(environment)) {
      res.status(400).json({ error: `Passphrase not set for ${environment}` });
      return;
    }

    const tenantList = getTenantsByEnv(environment);
    const results = await Promise.all(
      tenantList.map(async (tenant) => {
        try {
          const payload = buildPayload(tenant, null);
          const token = await signToken(environment, payload);
          return { name: tenant.name, token, error: null };
        } catch (err) {
          return {
            name: tenant.name,
            token: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    res.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/jwt/decode", (req, res): void => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  try {
    const { header, payload } = decodeToken(token);
    const expiryStatus = computeExpiryStatus(payload);
    res.json({ header, payload, expiryStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

export const jwtRoutes = router;
