// Scroll-through of the UniCore landing page and docs architecture.
import { chromium } from "playwright";
const W = 1440, H = 900, OUT = process.argv[2];
const b = await chromium.launch({ channel: "msedge" });
const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: `${OUT}/out`, size: { width: W, height: H } } });
await ctx.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.style.cssText = "position:fixed;z-index:2147483647;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:rgba(56,230,160,.9);box-shadow:0 0 0 3px rgba(255,255,255,.6);pointer-events:none;left:-50px;top:-50px";
    document.body.appendChild(c);
    addEventListener("mousemove", e => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
  });
});
const p = await ctx.newPage();
const pause = ms => p.waitForTimeout(ms);
async function smoothTo(y, ms) {
  await p.evaluate(async ([y, ms]) => {
    const y0 = scrollY, t0 = performance.now();
    await new Promise(r => { const f = t => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2; scrollTo(0, y0 + (y - y0) * e); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
  }, [y, ms]);
}
await p.goto("http://localhost:8088/", { waitUntil: "networkidle" });
await p.mouse.move(W * .86, H * .8);
await pause(2200);
await smoothTo(640, 2200); await pause(1600);
await smoothTo(1450, 2200); await pause(1800);
await smoothTo(0, 1600); await pause(500);
const docs = p.getByRole("link", { name: "Docs" }).first();
const bb = await docs.boundingBox();
await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 30 });
await pause(300);
await docs.click();
await p.waitForLoadState("networkidle");
await pause(1400);
const arch = await p.evaluate(() => { const h = [...document.querySelectorAll("h2")].find(e => /Architecture/.test(e.textContent)); return h.getBoundingClientRect().top + scrollY - 90; });
await smoothTo(arch, 2000); await pause(2400);
await smoothTo(arch + 520, 2200); await pause(2600);
await ctx.close(); await b.close();
