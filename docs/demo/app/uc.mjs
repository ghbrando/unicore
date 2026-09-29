// Shared helpers for driving UniCore locally (emulators on :9099/:8085).
export const PASSWORD = "UniCore-Demo-1!";
const OOB = "http://localhost:9099/emulator/v1/projects/unicore-junior-design/oobCodes";

// Register through the real UI, then follow the emulator's verification link.
export async function register(browser, { app, loginPath, name, email }) {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p.goto(`${app}${loginPath}`, { waitUntil: "networkidle" });
  await p.locator("button.toggle-btn").filter({ hasText: /register|sign up|create/i }).first().click();
  await p.fill('input[placeholder="John Doe"]', name);
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"], input[placeholder="••••••••"]', PASSWORD);
  await p.locator("button.auth-submit").click();
  for (let i = 0; i < 40; i++) {
    const codes = (await (await fetch(OOB)).json()).oobCodes ?? [];
    const c = codes.find(c => c.email === email && c.requestType === "VERIFY_EMAIL");
    if (c) { await fetch(c.oobLink); break; }
    await p.waitForTimeout(250);
  }
  await p.context().close();
}

export async function login(page, { app, loginPath, email }) {
  await page.goto(`${app}${loginPath}`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"], input[placeholder="••••••••"]', PASSWORD);
  await page.locator("button.auth-submit").click();
}

export async function resetEmulators() {
  await fetch("http://localhost:8085/emulator/v1/projects/unicore-junior-design/databases/(default)/documents", { method: "DELETE" });
  await fetch("http://localhost:9099/emulator/v1/projects/unicore-junior-design/accounts", { method: "DELETE" });
}

export async function providerOnboard(p) {
  await p.locator(".uc-checkbox").waitFor({ timeout: 20000 });
  await p.locator(".uc-checkbox").click(); await p.waitForTimeout(600);
  await p.locator("button.uc-btn").click();
  const next = () => p.locator("button.ob-btn--next");
  await p.getByText("US West", { exact: true }).click(); await p.waitForTimeout(500);
  const scan = p.getByRole("button", { name: /detect hardware/i });
  for (let i = 0; i < 6 && !(await scan.isVisible()); i++) { await next().click(); await p.waitForTimeout(900); }
  await scan.click();
  await p.getByText(/cores/i).first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(2500);
  await next().click();
}

export async function consumerOnboard(p) {
  await p.locator("#uc-agree").waitFor({ timeout: 20000 });
  await p.locator("#uc-agree").check(); await p.waitForTimeout(600);
  await p.getByRole("button", { name: /continue/i }).last().click();
  const overlay = p.locator(".ob-overlay");
  await overlay.waitFor({ timeout: 15000 });
  for (let i = 0; i < 5 && await overlay.isVisible(); i++) {
    await p.locator("button.ob-btn--next").click(); await p.waitForTimeout(1000);
  }
}
