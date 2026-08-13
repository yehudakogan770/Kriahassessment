const puppeteer = require("puppeteer");
const { buildHtml, escapeHtml } = require("./htmlTemplate");

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

async function renderPdf({ role, assembled, meta = {} }) {
  const html = buildHtml({ role, assembled, meta });
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });

    const title = meta.title || "Kriah Reading Assessment";
    const roleLabel = role === "teacher" ? "Teacher Copy" : "Student Copy";

    const pdfBytes = await page.pdf({
      format: "Letter",
      landscape: meta.orientation === "landscape",
      printBackground: true,
      margin: { top: "0.3in", bottom: "0.4in", left: "0.25in", right: "0.25in" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="font-size:8px; width:100%; text-align:center; color:#666; font-family:Arial, sans-serif;">
          ${escapeHtml(title)} &mdash; ${escapeHtml(roleLabel)} &nbsp;&bull;&nbsp;
          Page <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>`,
    });

    // Puppeteer returns a plain Uint8Array, which express's res.send()
    // does not recognize as binary (it would get JSON-serialized byte by
    // byte). Wrap it in a real Buffer so it's sent as raw bytes.
    return Buffer.from(pdfBytes);
  } finally {
    await page.close();
  }
}

async function shutdown() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

module.exports = { renderPdf, shutdown };
