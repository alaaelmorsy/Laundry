const fs = require('fs');
const puppeteer = require('puppeteer-core');

let browserInstance = null;

function resolveChromeExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    process.platform === 'win32' && 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    process.platform === 'win32' && 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return null;
}

async function getBrowser() {
  if (browserInstance) {
    // تحقق أن الـ browser لا يزال يعمل
    try {
      await browserInstance.version();
      return browserInstance;
    } catch (_) {
      browserInstance = null;
    }
  }
  const executablePath = resolveChromeExecutable();
  if (!executablePath) {
    throw new Error(
      'Chrome not found. Install Google Chrome or set CHROME_PATH to chrome.exe (required for PDF export on the web server).'
    );
  }
  browserInstance = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  return browserInstance;
}

/**
 * @param {string} html
 * @param {{ landscape?: boolean }} opts
 * @returns {Promise<Buffer>}
 */
async function htmlToPdfBuffer(html, opts = {}) {
  let browser;
  try {
    browser = await getBrowser();
  } catch (e) {
    throw e;
  }
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 120000 });
    const buf = await page.pdf({
      format: 'A4',
      landscape: !!opts.landscape,
      printBackground: true,
      margin: { top: '0.4cm', bottom: '0.4cm', left: '0.4cm', right: '0.4cm' }
    });
    return Buffer.from(buf);
  } catch (err) {
    // إذا فشل بسبب انقطاع الـ browser، أعد تعيينه وحاول مرة أخرى
    browserInstance = null;
    browser = await getBrowser();
    const page2 = await browser.newPage();
    try {
      await page2.setContent(html, { waitUntil: 'load', timeout: 120000 });
      const buf = await page2.pdf({
        format: 'A4',
        landscape: !!opts.landscape,
        printBackground: true,
        margin: { top: '0.4cm', bottom: '0.4cm', left: '0.4cm', right: '0.4cm' }
      });
      return Buffer.from(buf);
    } finally {
      await page2.close().catch(() => {});
    }
  } finally {
    await page.close().catch(() => {});
  }
}

async function closePdfBrowser() {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

module.exports = { htmlToPdfBuffer, closePdfBrowser };
