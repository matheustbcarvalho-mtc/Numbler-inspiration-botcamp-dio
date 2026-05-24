import { chromium } from "playwright";

const BASE = process.env.TEST_BASE || "http://127.0.0.1:8000";
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Defina TEST_EMAIL e TEST_PASSWORD (não grave senha no repositório).");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(`${BASE}/login.html`, { waitUntil: "domcontentloaded" });
  await page.fill("#login-email", EMAIL);
  await page.fill("#login-password", PASSWORD);
  await page.click("#form-login .auth-submit");

  await page.waitForURL(/index\.html/, { timeout: 25000 });
  await page.waitForSelector("#spin-button", { timeout: 20000 });

  await page.waitForFunction(
    () => {
      const btn = document.getElementById("btn-buy-scatters");
      return btn && !btn.classList.contains("hidden");
    },
    { timeout: 20000 }
  );

  const btn = page.locator("#btn-buy-scatters");
  const info = await page.evaluate(() => ({
    scatterEmails: window.DEALER_SCATTER_BUY_EMAILS,
    isDealer: window.GameAuth?.isDealer?.(),
    userEmail: window.GameAuth?.getUserEmail?.(),
    btnHidden: document.getElementById("btn-buy-scatters")?.classList.contains("hidden"),
    btnText: document.getElementById("btn-buy-scatters")?.textContent?.trim(),
    userBar: document.getElementById("user-email")?.textContent?.trim(),
  }));

  const visible = await btn.isVisible();

  console.log("--- TESTE BOTÃO 3 SCATTERS ---");
  console.log("Base URL:", BASE);
  console.log("Login:", EMAIL);
  console.log("Botão visível (Playwright):", visible);
  console.log("Botão sem classe hidden:", !info.btnHidden);
  console.log("Texto do botão:", info.btnText);
  console.log("Barra usuário:", info.userBar);
  console.log("GameAuth.isDealer():", info.isDealer);
  console.log("DEALER_SCATTER_BUY_EMAILS:", info.scatterEmails);

  if (!visible || info.btnHidden) {
    console.error("FALHA: botão não apareceu.");
    process.exit(1);
  }
  console.log("OK: botão 3 Scatters (50) apareceu.");
} catch (e) {
  const authMsg = await page.locator("#auth-message").innerText().catch(() => "");
  const url = page.url();
  console.error("FALHA:", e.message);
  if (authMsg) console.error("Mensagem login:", authMsg);
  console.error("URL atual:", url);
  process.exit(1);
} finally {
  await browser.close();
}
