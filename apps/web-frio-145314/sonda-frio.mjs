import { chromium } from '@playwright/test';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
const log = []; page.on('pageerror', (e) => log.push(`[pageerror] ${e.message.slice(0, 200)}`)); page.on('console', (m) => { if (m.type() === 'error') log.push(`[console.error] ${m.text().slice(0, 200)}`); });
const t0 = Date.now(); let tHtml = 0;
await page.goto('http://localhost:3021/', { waitUntil: 'commit', timeout: 180000 }); tHtml = (Date.now() - t0) / 1000;
let tCarregando = null, tCena = null;
for (let i = 0; i < 180; i++) {
  const s = (Date.now() - t0) / 1000;
  if (tCarregando === null && await page.getByTestId('carregando').count()) tCarregando = s;
  if (await page.getByTestId('cena').count()) { tCena = s; break; }
  await page.waitForTimeout(1000);
}
console.log(`HTML servido em ${tHtml.toFixed(1)}s; "Carregando manifesto…" visível a partir de ${tCarregando}s; cena montada em ${tCena}s`);
for (const l of log) console.log(l); await b.close();
