import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
import { request, type FullConfig } from "@playwright/test";

// One API login for the whole run (the login endpoint is rate-limited).
export default async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.A11Y_BASE_URL ?? "http://localhost:8080";
  const context = await request.newContext({ baseURL });
  const response = await context.post("/api/auth/login", {
    headers: { Origin: baseURL, "X-Requested-With": "BlicklingFieldbook" },
    data: {
      email: process.env.A11Y_EMAIL ?? "devadmin@example.com",
      password: process.env.A11Y_PASSWORD ?? "DevAdminPass123!x",
    },
  });
  if (!response.ok()) {
    throw new Error(`a11y global setup: login failed with ${response.status()} — is the dev stack running with the dev admin seeded?`);
  }
  const dir = path.join(here, ".auth");
  fs.mkdirSync(dir, { recursive: true });
  await context.storageState({ path: path.join(dir, "state.json") });
  await context.dispose();
}
