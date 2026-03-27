import { Router } from "express";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";

const router = Router();

// ── Config ──────────────────────────────────────────────────────────

const DATA_ROOT = join(process.cwd(), "data", "jwt");
const CONFIG_PATH = join(DATA_ROOT, "tenants.json");

interface Product {
  iss: string;
}

interface Profile {
  description: string;
  sub: string;
  aid: string;
  uid?: string;
  email?: string;
  roles?: string;
}

interface TenantConfig {
  products: Record<string, Product>;
  profiles: Record<string, Profile>;
  environments: Record<string, { keyFile: string; passphraseEnvVar: string }>;
  defaults: {
    product: string;
    roles: string;
    uid: string;
    expirySeconds: number;
  };
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

const config: TenantConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

function saveConfig(): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, "\t"), "utf-8");
}

function getActiveTenants(): Tenant[] {
  return config.tenants.filter((t) => !t._comment);
}

function getEnvironmentNames(): string[] {
  return Object.keys(config.environments);
}

function getTenantsByEnv(env: string): Tenant[] {
  return getActiveTenants().filter((t) => t.environment === env);
}

function readKeyFile(env: string): string {
  const envConfig = config.environments[env];
  if (!envConfig) throw new Error(`Unknown environment: ${env}`);
  return readFileSync(join(DATA_ROOT, envConfig.keyFile), "utf-8");
}

function resolveIss(product?: string): string {
  const key = product || config.defaults.product;
  const p = config.products[key];
  return p ? p.iss : key;
}

function buildPayload(
  tenant: Tenant,
  customExpiryHours: number | null,
  product?: string
) {
  const now = Math.floor(Date.now() / 1000);
  const expiry =
    customExpiryHours != null
      ? customExpiryHours * 3600
      : config.defaults.expirySeconds;

  return {
    iss: resolveIss(product),
    sub: tenant.sub,
    aid: tenant.aid,
    l2cid: tenant.l2cid,
    roles: tenant.roles || config.defaults.roles,
    uid: config.defaults.uid,
    nbf: now,
    exp: now + expiry,
    iat: now,
  };
}

function buildProfilePayload(
  profileKey: string,
  customExpiryHours: number | null,
  product?: string
) {
  const profile = config.profiles[profileKey];
  if (!profile) throw new Error(`Unknown profile: ${profileKey}`);

  const now = Math.floor(Date.now() / 1000);
  const expiry =
    customExpiryHours != null
      ? customExpiryHours * 3600
      : config.defaults.expirySeconds;

  return {
    iss: resolveIss(product),
    sub: profile.sub,
    aid: profile.aid,
    roles: profile.roles || config.defaults.roles,
    uid: profile.uid || config.defaults.uid,
    ...(profile.email ? { email: profile.email } : {}),
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

// ── Auto-load passphrases from .env ─────────────────────────────────

for (const [envName, envConfig] of Object.entries(config.environments)) {
  const envVar = envConfig.passphraseEnvVar;
  const value = process.env[envVar];
  if (value) {
    const result = setPassphrase(envName, value);
    if (result.success) {
      console.log(`Auto-loaded passphrase for ${envName} (from ${envVar})`);
    } else {
      console.warn(
        `Failed to auto-load passphrase for ${envName}: ${result.error}`
      );
    }
  }
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

// ── Read Routes (all under /api/jwt) ────────────────────────────────

router.get("/jwt/environments", (_req, res) => {
  res.json({ environments: getEnvironmentNames() });
});

router.get("/jwt/products", (_req, res) => {
  res.json({ products: config.products, default: config.defaults.product });
});

router.get("/jwt/profiles", (_req, res) => {
  res.json({ profiles: config.profiles });
});

router.get("/jwt/tenants", (req, res): void => {
  const env = req.query.env as string | undefined;
  if (!env) {
    res.status(400).json({ error: "Missing env query parameter" });
    return;
  }
  if (!config.environments[env]) {
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

router.get("/jwt/tenants/all", (_req, res) => {
  const all = getActiveTenants().map((t) => ({
    name: t.name,
    aid: t.aid,
    environment: t.environment,
    sub: t.sub,
    l2cid: t.l2cid,
    ...(t.roles ? { roles: t.roles } : {}),
  }));
  res.json({ tenants: all });
});

router.post("/jwt/passphrase", (req, res): void => {
  const { environment, passphrase } = req.body;
  if (!environment || !passphrase) {
    res.status(400).json({ error: "Missing environment or passphrase" });
    return;
  }
  if (!config.environments[environment]) {
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
    const { environment, tenantIndex, customExpiryHours, product } = req.body;
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
    const payload = buildPayload(tenant, customExpiryHours ?? null, product);
    const token = await signToken(environment, payload);

    res.json({ token, payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/jwt/bulk-generate", async (req, res): Promise<void> => {
  try {
    const { environment, product } = req.body;
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
          const payload = buildPayload(tenant, null, product);
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

router.post("/jwt/generate-profile", async (req, res): Promise<void> => {
  try {
    const { environment, product, profile, customExpiryHours } = req.body;
    if (!environment) {
      res.status(400).json({ error: "Missing environment" });
      return;
    }
    if (!profile) {
      res.status(400).json({ error: "Missing profile" });
      return;
    }
    if (!config.profiles[profile]) {
      res.status(400).json({ error: `Unknown profile: ${profile}` });
      return;
    }
    if (!hasPassphrase(environment)) {
      res.status(400).json({ error: `Passphrase not set for ${environment}` });
      return;
    }

    const payload = buildProfilePayload(
      profile,
      customExpiryHours ?? null,
      product
    );
    const token = await signToken(environment, payload);

    res.json({ token, payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/jwt/generate-adhoc", async (req, res): Promise<void> => {
  try {
    const { environment, sub, aid, l2cid, product, customExpiryHours, roles } = req.body;
    if (!environment || !sub || !aid || !l2cid) {
      res.status(400).json({ error: "Missing required fields: environment, sub, aid, l2cid" });
      return;
    }
    if (!hasPassphrase(environment)) {
      res.status(400).json({ error: `Passphrase not set for ${environment}` });
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const expiry =
      customExpiryHours != null
        ? customExpiryHours * 3600
        : config.defaults.expirySeconds;
    const payload = {
      iss: resolveIss(product),
      sub,
      aid,
      l2cid,
      roles: roles || config.defaults.roles,
      uid: config.defaults.uid,
      nbf: now,
      exp: now + expiry,
      iat: now,
    };
    const token = await signToken(environment, payload);
    res.json({ token, payload });
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

// ── Manage Routes (CRUD for tenants, products, profiles) ─────────────

router.post("/jwt/tenants", (req, res): void => {
  const { name, environment, sub, aid, l2cid, roles } = req.body;
  if (!name || !environment || !sub || !aid || !l2cid) {
    res.status(400).json({ error: "Missing required fields: name, environment, sub, aid, l2cid" });
    return;
  }
  if (!config.environments[environment]) {
    res.status(400).json({ error: `Unknown environment: ${environment}` });
    return;
  }
  const tenant: Tenant = { name, environment, sub, aid, l2cid };
  if (roles) tenant.roles = roles;
  config.tenants.push(tenant);
  saveConfig();
  res.json({ success: true, tenant });
});

router.delete("/jwt/tenants", (req, res): void => {
  const { name, environment } = req.body;
  if (!name || !environment) {
    res.status(400).json({ error: "Missing name or environment" });
    return;
  }
  const before = config.tenants.length;
  config.tenants = config.tenants.filter(
    (t) => !(t.name === name && t.environment === environment)
  );
  if (config.tenants.length === before) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  saveConfig();
  res.json({ success: true });
});

router.post("/jwt/products", (req, res): void => {
  const { name, iss } = req.body;
  if (!name) {
    res.status(400).json({ error: "Missing required field: name" });
    return;
  }
  config.products[name] = { iss: iss || name };
  saveConfig();
  res.json({ success: true, product: { name, iss: config.products[name].iss } });
});

router.delete("/jwt/products/:name", (req, res): void => {
  const { name } = req.params;
  if (!config.products[name]) {
    res.status(404).json({ error: `Product not found: ${name}` });
    return;
  }
  delete config.products[name];
  saveConfig();
  res.json({ success: true });
});

router.post("/jwt/profiles", (req, res): void => {
  const { name, description, sub, aid, uid, email, roles } = req.body;
  if (!name || !sub || !aid) {
    res.status(400).json({ error: "Missing required fields: name, sub, aid" });
    return;
  }
  const profile: Profile = { description: description || "", sub, aid };
  if (uid) profile.uid = uid;
  if (email) profile.email = email;
  if (roles) profile.roles = roles;
  config.profiles[name] = profile;
  saveConfig();
  res.json({ success: true, profile: { name, ...profile } });
});

router.delete("/jwt/profiles/:name", (req, res): void => {
  const { name } = req.params;
  if (!config.profiles[name]) {
    res.status(404).json({ error: `Profile not found: ${name}` });
    return;
  }
  delete config.profiles[name];
  saveConfig();
  res.json({ success: true });
});

export const jwtRoutes = router;
