const {chromium} = require('playwright-core');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'});
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0,200)); });
  await page.goto('http://localhost:8077/', {waitUntil:'networkidle'});
  await page.screenshot({path:'shots/shot-hero.png'});
  await page.fill('#promptInput', 'massive thunder cracking over a neon city in the rain');
  await page.click('#forgeBtn');
  await page.waitForTimeout(10000);
  await page.screenshot({path:'shots/shot-variants.png'});
  const ups = await page.$$('.rate .up');
  if (ups.length) { await ups[0].click(); await page.waitForTimeout(800); }
  await page.screenshot({path:'shots/shot-taste.png', fullPage:true});
  console.log('errors:', JSON.stringify(errors.slice(0,5)));
  console.log('variants:', await page.$$eval('.variant', els => els.length));
  console.log('tags:', await page.$eval('#parsedTags', el => el.textContent));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
