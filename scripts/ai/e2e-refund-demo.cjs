// Browser end-to-end check of the refund feature: log in to the dashboard, refund part of a payment, then the rest.
// Usage: node scripts/ai/e2e-refund-demo.cjs (dashboard on :8088 proxying the API; edit the merchant id and transaction id).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8088/');
  const inputs = p.locator('form input');
  await inputs.nth(0).fill('3a1a204a-4b91-4739-b955-45e95e2e2e34'); await inputs.nth(1).fill('owner@betadigital.example'); await inputs.nth(2).fill('FilsPaySeed!2026');
  await p.locator('form button[type=submit]').click();
  const code = await p.locator('code').first().textContent({ timeout: 10000 });
  await p.locator('form input').first().fill(code.trim());
  await p.locator('form button[type=submit]').click();
  await p.waitForTimeout(1500);
  await p.goto('http://localhost:8088/dashboard/transactions/15074bd9-bf98-4298-b792-d65eb150fcad');
  await p.getByRole('button', { name: 'Refund' }).click();
  await p.locator('form input[type=number]').fill('100000');
  await p.locator('form button[type=submit]').click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'after_partial.png', fullPage: true });
  console.log('after partial:', (await p.locator('dl').innerText()).replace(/\n/g,' | '));
  await p.getByRole('button', { name: 'Refund' }).click();
  await p.locator('form button[type=submit]').click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'after_full.png', fullPage: true });
  console.log('after full:', (await p.locator('dl').innerText()).replace(/\n/g,' | '));
  console.log('refund button still there:', await p.getByRole('button', { name: 'Refund' }).count());
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
