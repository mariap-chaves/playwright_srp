// @ts-nocheck
import { test, expect } from '@playwright/test';

test.setTimeout(120000);

test('SRP UCR — all internal links respond with HTTP < 400', async ({ page, request }) => {
  await page.goto('https://srp.ucr.ac.cr', { waitUntil: 'networkidle' });

  const baseOrigin = new URL(page.url()).origin;

  // Get raw hrefs from the page (browser context) and resolve them in Node context
  const rawHrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') || '')
      .filter(Boolean)
      .filter((h) => !h.startsWith('mailto:') && !h.startsWith('tel:') && !h.startsWith('javascript:'))
  );

  const links = rawHrefs
    .map((h) => {
      try { return new URL(h, page.url()).href; } catch { return null; }
    })
    .filter(Boolean);

  const internal = Array.from(new Set(links)).filter((u) => {
    try { return new URL(u).origin === baseOrigin; } catch { return false; }
  });

  // exclude links that only change the hash or equal the current page
  const currentKey = new URL(page.url());
  const filtered = internal.filter((u) => {
    try {
      const nu = new URL(u);
      return (nu.pathname + nu.search) !== (currentKey.pathname + currentKey.search);
    } catch {
      return false;
    }
  });

  console.log(`Found ${filtered.length} internal links to check.`);
  expect(filtered.length).toBeGreaterThan(0);

  const failures = [];
  for (const url of filtered) {
    try {
      const res = await request.get(url, { maxRedirects: 5 });
      const status = res.status();
      if (!(status > 0 && status < 400)) {
        failures.push({ url, status });
        console.log('FAIL', url, status);
      } else {
        console.log('OK', url, status);
      }
    } catch (err) {
      failures.push({ url, error: String(err) });
      console.log('ERROR', url, String(err));
    }
  }

  if (failures.length > 0) {
    console.log('Internal link failures:', failures);
  }

  expect(failures.length).toBe(0);
});
