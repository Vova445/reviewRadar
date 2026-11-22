import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.argv[2];
if (!new Set(["staging", "production"]).has(target)) {
  throw new Error("Usage: node scripts/prepare-cloudflare-deployment.mjs <staging|production>");
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID ?? "";
const appBaseUrl = process.env.APP_BASE_URL ?? "";
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";
if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("CLOUDFLARE_ACCOUNT_ID must be a 32-character Cloudflare account ID.");
if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(databaseId)) throw new Error("CLOUDFLARE_D1_DATABASE_ID must be the target D1 database UUID.");
for (const [name, value] of [["APP_BASE_URL", appBaseUrl], ["GOOGLE_REDIRECT_URI", googleRedirectUri]]) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.hostname.endsWith(".invalid")) throw new Error(`${name} must be a real HTTPS URL configured in the GitHub environment.`);
}

const requiredSecrets = [
  "AUTH_PASSWORD_PEPPER",
  "RESEND_API_KEY",
  "OAUTH_TOKEN_ENCRYPTION_KEYS",
  "OAUTH_TOKEN_ROTATION_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_SYNC_SECRET",
];
const missing = requiredSecrets.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing required GitHub environment secrets: ${missing.join(", ")}`);
if (!process.env.OAUTH_TOKEN_ENCRYPTION_KEY_ID) throw new Error("Missing required GitHub environment variable: OAUTH_TOKEN_ENCRYPTION_KEY_ID");
for (const key of ["GOOGLE_PUBSUB_AUDIENCE", "GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL"]) {
  if (!process.env[key]) throw new Error(`Missing required GitHub environment variable: ${key}`);
}

const sourcePath = resolve("wrangler.jsonc");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const selected = source.env?.[target];
if (!selected) throw new Error(`Wrangler environment '${target}' is missing.`);
const config = { ...source, ...selected };
delete config.env;
config.account_id = accountId;
config.d1_databases = config.d1_databases.map((binding) => ({ ...binding, database_id: databaseId }));
config.vars = {
  ...config.vars,
  APP_BASE_URL: appBaseUrl,
  GOOGLE_REDIRECT_URI: googleRedirectUri,
  GOOGLE_PUBSUB_AUDIENCE: process.env.GOOGLE_PUBSUB_AUDIENCE,
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL,
  OAUTH_TOKEN_ENCRYPTION_KEY_ID: process.env.OAUTH_TOKEN_ENCRYPTION_KEY_ID,
  EMAIL_FROM: process.env.EMAIL_FROM ?? "ReviewRadar <noreply@example.com>",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  SENTRY_ENVIRONMENT: target,
};

const outputDirectory = resolve(".wrangler");
await mkdir(outputDirectory, { recursive: true });
const configPath = resolve(outputDirectory, `wrangler-${target}.json`);
const secretsPath = resolve(outputDirectory, `secrets-${target}.json`);
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

const optionalSecrets = ["OAUTH_TOKEN_ENCRYPTION_KEY", "OPENAI_API_KEY", "SENTRY_DSN"];
const secrets = Object.fromEntries([...requiredSecrets, ...optionalSecrets].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
await writeFile(secretsPath, `${JSON.stringify(secrets, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
await chmod(secretsPath, 0o600).catch(() => undefined);
process.stdout.write(`Prepared isolated Wrangler config and secret file for ${target}.\n`);
