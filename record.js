const {chromium} = require('playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'});
  const ctx = await browser.newContext({
    viewport: {width: 1440, height: 900},
    recordVideo: {dir: 'video/', size: {width: 1440, height: 900}}
  });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8077/', {waitUntil: 'networkidle'});
  await sleep(2000);
  // n1: hero + typing (2s - 24s)
  await p.click('#promptInput');
  await p.type('#promptInput', 'massive thunder cracking over a neon city in the rain', {delay: 90});
  await sleep(9000);
  // n2: forge + variants (24s - 54s)
  await p.click('#forgeBtn');
  await sleep(10000);
  await p.evaluate(() => document.querySelector('#results').scrollIntoView({block: 'start'}));
  await sleep(8000);
  await p.hover('.variant:nth-child(2) .play');
  await sleep(6000);
  // n3: rate + taste + reforge (54s - 82s)
  await p.click('.variant:nth-child(1) .rate .up');
  await sleep(3000);
  await p.evaluate(() => document.querySelector('.taste-panel').scrollIntoView({block: 'center'}));
  await sleep(9000);
  await p.evaluate(() => document.querySelector('.hero').scrollIntoView());
  await sleep(2000);
  await p.click('#forgeBtn');
  await sleep(9000);
  await p.evaluate(() => document.querySelector('#results').scrollIntoView({block: 'start'}));
  await sleep(3000);
  // n4: how it works (82s - 110s)
  await p.evaluate(() => document.querySelector('.how').scrollIntoView({block: 'start'}));
  await sleep(14000);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(14000);
  // n5: close (110s - 126s)
  await p.evaluate(() => document.querySelector('.hero').scrollIntoView());
  await sleep(12000);
  await ctx.close();
  await browser.close();
  console.log('recorded');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
