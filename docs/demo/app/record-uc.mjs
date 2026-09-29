// Records the real UniCore provider + consumer flow against local emulators and relay.
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { register, login, resetEmulators, PASSWORD } from "./uc.mjs";

const OUT = process.argv[2];
const W = 1440, H = 900;
const marks = {};
const b = await chromium.launch({ channel: "msedge" });

const P = { app: "http://localhost:5133", loginPath: "/provider-login", name: "Brandon Magana", email: "brandon@unicore.dev" };
const C = { app: "http://localhost:5157", loginPath: "/client-login", name: "Alex Rivera", email: "alex@unicore.dev" };
await resetEmulators();
await register(b, P);
await register(b, C);

async function recordedPage(name, color) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: `${OUT}/${name}`, size: { width: W, height: H } } });
  marks[name] = { start: Date.now() };
  await ctx.addInitScript(color => {
    addEventListener("DOMContentLoaded", () => {
      const c = document.createElement("div");
      c.style.cssText = `position:fixed;z-index:2147483647;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:${color};box-shadow:0 0 0 3px rgba(255,255,255,.65);pointer-events:none;left:-40px;top:-40px;transition:transform .12s`;
      document.body.appendChild(c);
      addEventListener("mousemove", e => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
      addEventListener("mousedown", () => (c.style.transform = "scale(.7)"), true);
      addEventListener("mouseup", () => (c.style.transform = "scale(1)"), true);
    });
  }, color);
  const page = await ctx.newPage();
  return { ctx, page };
}
const mark = (name, key) => { marks[name][key] = (Date.now() - marks[name].start) / 1000; console.log(name, key, marks[name][key]); };
async function glideClick(p, loc) {
  await loc.waitFor();
  const bb = await loc.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 22 });
  await p.waitForTimeout(200);
  try { await loc.click({ timeout: 15000 }); }
  catch (e) { await p.screenshot({ path: `${OUT}/fail.png` }); throw e; }
}
async function typeInto(p, loc, text) { await glideClick(p, loc); await loc.pressSequentially(text, { delay: 45 }); }

// ── Provider ─────────────────────────────────────────────
const prov = await recordedPage("provider", "rgba(0,224,122,.9)");
const pp = prov.page;
await pp.goto(`${P.app}${P.loginPath}`, { waitUntil: "networkidle" });
await pp.mouse.move(W * .7, H * .75);
mark("provider", "login");
await pp.waitForTimeout(800);
await typeInto(pp, pp.locator('input[type="email"]'), P.email);
await typeInto(pp, pp.locator('input[placeholder="••••••••"]'), PASSWORD);
await glideClick(pp, pp.locator("button.auth-submit"));
await glideClick(pp, pp.locator(".uc-checkbox"));
await pp.waitForTimeout(600);
await glideClick(pp, pp.locator("button.uc-btn"));
const next = () => pp.locator("button.ob-btn--next");
const stepNow = async () => Number(((await pp.locator("body").innerText()).match(/step (\d) of 4/i) || [0, 0])[1]);
await pp.getByText(/step 1 of 4/i).first().waitFor({ timeout: 20000 });
for (let guard = 0; guard < 10; guard++) {
  const n = await stepNow();
  if (n === 4) break;
  await pp.waitForTimeout(700);
  if (n === 1) await glideClick(pp, pp.getByText("US West", { exact: true }));
  if ((await stepNow()) === n) await glideClick(pp, next());
  for (let i = 0; i < 20 && (await stepNow()) === n; i++) await pp.waitForTimeout(150);
}
const scan = pp.getByRole("button", { name: /detect hardware/i });
await glideClick(pp, scan);
await pp.getByText(/cores/i).first().waitFor({ timeout: 30000 });
await pp.waitForTimeout(2600);
await glideClick(pp, next());
await pp.waitForTimeout(1500);
await pp.mouse.move(W * .5, H * .35, { steps: 20 });
await pp.waitForTimeout(2500);
mark("provider", "online");

// ── Consumer ─────────────────────────────────────────────
const cons = await recordedPage("consumer", "rgba(56,160,255,.95)");
const cp = cons.page;
await cp.goto(`${C.app}${C.loginPath}`, { waitUntil: "networkidle" });
await cp.mouse.move(W * .7, H * .75);
mark("consumer", "login");
await cp.waitForTimeout(800);
await typeInto(cp, cp.locator('input[type="email"]'), C.email);
await typeInto(cp, cp.locator('input[placeholder="••••••••"]'), PASSWORD);
await glideClick(cp, cp.locator("button.auth-submit"));
await glideClick(cp, cp.locator("#uc-agree"));
await cp.waitForTimeout(600);
await glideClick(cp, cp.getByRole("button", { name: /continue/i }).last());
const ov = cp.locator(".ob-overlay");
await ov.waitFor({ timeout: 15000 });
for (let i = 0; i < 5; i++) {
  const nb = cp.locator(".ob-overlay button.ob-btn--next");
  if (!(await nb.isVisible().catch(() => false))) break;
  const bb = await nb.boundingBox().catch(() => null);
  if (!bb) break;
  await cp.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 22 });
  await nb.click({ timeout: 3000 }).catch(() => {});
  await cp.waitForTimeout(1100);
}
await cp.waitForTimeout(1200);
await glideClick(cp, cp.getByRole("button", { name: /create vm/i }).first());
await cp.waitForTimeout(800);
await typeInto(cp, cp.locator("input.cvm-input[placeholder='my-ubuntu-vm']"), "demo-box");
await cp.waitForTimeout(1500);
await glideClick(cp, cp.locator("button.cvm-btn-primary"));
await cp.locator(".cvm-modal").getByText(/US-West/).first().waitFor({ timeout: 20000 });
await cp.waitForTimeout(3000);
mark("consumer", "match");
await glideClick(cp, cp.locator("button.cvm-btn-primary").first());
mark("consumer", "provisioning");
await cp.locator(".cvm-modal").getByText(/provisioning/i).first().waitFor({ state: "detached", timeout: 400000 });
mark("consumer", "provisioned");
await cp.waitForTimeout(2000);
const close = cp.getByRole("button", { name: /^close$/i });
await close.first().waitFor({ timeout: 8000 }).then(() => glideClick(cp, close.first())).catch(() => {});
await cp.getByText(/setting up/i).first().waitFor({ timeout: 20000 }).catch(() => {});
await cp.waitForTimeout(1500);
mark("consumer", "settingup");
await cp.mouse.move(W * .45, H * .6, { steps: 20 });
for (let i = 0; i < 480; i++) {
  if (cp.url().includes("client-login")) break;
  if (!(await cp.getByText(/setting up/i).count())) break;
  await cp.waitForTimeout(1000);
}
mark("consumer", "running");
if (cp.url().includes("client-login")) {
  // The idle session dropped during the long wait; sign back in (cut from the edit).
  mark("consumer", "reloginStart");
  await cp.fill('input[type="email"]', C.email);
  await cp.fill('input[placeholder="��������"]', PASSWORD);
  await cp.locator("button.auth-submit").click();
  await cp.getByRole("button", { name: /ssh/i }).first().waitFor({ timeout: 30000 });
  for (let i = 0; i < 300 && await cp.getByText(/setting up/i).count(); i++) await cp.waitForTimeout(1000);
  await cp.waitForTimeout(1500);
  mark("consumer", "reloginEnd");
}
await cp.waitForTimeout(2500);
const launched = cp.getByRole("button", { name: /^close$/i });
if (await launched.isVisible().catch(() => false)) { await glideClick(cp, launched.first()); await cp.waitForTimeout(1200); }
await glideClick(cp, cp.getByRole("button", { name: /ssh/i }).first());
await cp.getByText(/connected/i).first().waitFor({ timeout: 30000 });
await cp.waitForTimeout(1500);
const shell = cp.locator(".xterm-helper-textarea, .xterm").first();
await shell.click();
const cmds = [
  "clear",
  "whoami && hostname",
  "echo cpu $(awk '{print $1/$2}' /sys/fs/cgroup/cpu.max)",
  "echo mem $(($(cat /sys/fs/cgroup/memory.max)>>30))G",
  "grep PRETTY /etc/os-release",
];
for (const c of cmds) { await cp.keyboard.type(c, { delay: 38 }); await cp.keyboard.press("Enter"); await cp.waitForTimeout(1300); }
await cp.waitForTimeout(2500);
mark("consumer", "end");

// ── Provider sees the VM ─────────────────────────────────
mark("provider", "back");
await pp.reload({ waitUntil: "networkidle" });
await pp.getByText("demo-box").first().waitFor({ timeout: 30000 });
await pp.waitForTimeout(1200);
const card = pp.getByText(/active vms/i).first();
const rb = await card.boundingBox();
await pp.mouse.move(rb.x + 180, rb.y + 60, { steps: 25 });
await pp.waitForTimeout(3500);
mark("provider", "end");

await cons.ctx.close();
await prov.ctx.close();
await b.close();
writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks, null, 2));
