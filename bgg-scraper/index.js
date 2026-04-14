"use strict";

/**
 * bgg-scraper / index.js
 *
 * Headless-Chrome scraper for BoardGameGeek.
 * Runs as an HTTP API service on port 3002.
 *
 * Endpoints:
 *   GET /search?q=<term>[&type=boardgame]   → JSON array of search results
 *   GET /game/:id                            → JSON object with full game details
 *   GET /health                              → { status: "ok" }
 *
 * CLI usage (bgg-search script calls this):
 *   BGG_SEARCH_TERM="catan" node index.js --cli
 *
 * Environment variables:
 *   PORT            – HTTP port (default: 3002)
 *   BGG_MAX_RETRIES – retry attempts (default: 3)
 *   BGG_TIMEOUT_MS  – navigation timeout in ms (default: 60000)
 *   BGG_HEADLESS    – "true" | "false" (default: "true")
 */

const puppeteer = require("puppeteer");
const http = require("http");
const url = require("url");

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  port: parseInt(process.env.PORT || "3002", 10),
  maxRetries: parseInt(process.env.BGG_MAX_RETRIES || "3", 10),
  timeoutMs: parseInt(process.env.BGG_TIMEOUT_MS || "60000", 10),
  headless: process.env.BGG_HEADLESS !== "false",
};

// ─── Logging ─────────────────────────────────────────────────────────────────

const log = {
  info: (...a) => process.stderr.write(`[INFO]  ${a.join(" ")}\n`),
  warn: (...a) => process.stderr.write(`[WARN]  ${a.join(" ")}\n`),
  error: (...a) => process.stderr.write(`[ERROR] ${a.join(" ")}\n`),
};

// ─── Browser management (single shared browser instance) ─────────────────────

let browserInstance = null;
let browserLock = false;

async function getBrowser() {
  if (browserInstance) {
    try {
      // Quick liveness check
      await browserInstance.version();
      return browserInstance;
    } catch {
      browserInstance = null;
    }
  }

  log.info("Launching system Chromium…");
  browserInstance = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
    ],
    defaultViewport: { width: 1280, height: 900 },
    timeout: CONFIG.timeoutMs,
  });

  browserInstance.on("disconnected", () => {
    log.warn("Browser disconnected, will relaunch on next request");
    browserInstance = null;
  });

  return browserInstance;
}

// ─── Page setup ──────────────────────────────────────────────────────────────

async function preparePage(browser) {
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
  });

  // Block images/fonts/media to speed things up
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (["image", "font", "media"].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  page.setDefaultTimeout(CONFIG.timeoutMs);
  page.setDefaultNavigationTimeout(CONFIG.timeoutMs);

  return page;
}

// ─── Search scraper ──────────────────────────────────────────────────────────

async function scrapeSearch(searchTerm, searchType = "boardgame") {
  const searchUrl = `https://boardgamegeek.com/search/${searchType}?sort=rank&q=${encodeURIComponent(searchTerm)}`;
  log.info(`Searching: ${searchUrl}`);

  const browser = await getBrowser();
  const page = await preparePage(browser);

  try {
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.timeoutMs,
    });

    log.info("Waiting for results table…");
    await page.waitForSelector("table#collectionitems tr[id^='row_']", {
      timeout: CONFIG.timeoutMs,
    });

    const results = await page.evaluate(() => {
      const clean = (el) => (el ? el.textContent.trim() : "");
      const toFloat = (s) => {
        const n = parseFloat((s || "").replace(/[^\d.]/g, ""));
        return isNaN(n) ? null : n;
      };
      const toInt = (s) => {
        const n = parseInt((s || "").replace(/[^\d]/g, ""), 10);
        return isNaN(n) ? null : n;
      };

      const rows = Array.from(
        document.querySelectorAll("table#collectionitems tr[id^='row_']")
      );

      return rows
        .map((row) => {
          const rankText = clean(row.querySelector("td.collection_rank"));
          const rank = /^\d+$/.test(rankText) ? toInt(rankText) : null;

          const anchor = row.querySelector(".collection_objectname a.primary");
          const title = anchor ? anchor.textContent.trim() : null;
          const href = anchor ? anchor.getAttribute("href") : null;
          const link = href ? `https://boardgamegeek.com${href}` : null;

          let type = null;
          let bggId = null;
          if (href) {
            const parts = href.split("/").filter(Boolean);
            type = parts[0] || null;
            bggId = parseInt(parts[1], 10);
          }

          const yearSpan = row.querySelector(
            ".collection_objectname .smallerfont.dull"
          );
          const yearMatch = yearSpan
            ? yearSpan.textContent.match(/(\d{4})/)
            : null;
          const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

          const descEl = row.querySelector(
            ".collection_objectname p.smallefont"
          );
          const description = descEl ? descEl.textContent.trim() : null;

          const ratingCells = Array.from(
            row.querySelectorAll("td.collection_bggrating")
          );
          const geekRating = parseFloat(clean(ratingCells[0])) || null;
          const avgRating = parseFloat(clean(ratingCells[1])) || null;
          const numVoters = parseInt(clean(ratingCells[2]), 10) || null;

          // Extract thumbnail from the search results table
          const imgEl = row.querySelector("td.collection_thumbnail img");
          let thumbnail = null;
          if (imgEl) {
            thumbnail = imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || null;
            // Upgrade to higher resolution if it's a cf.geekdo-images URL
            if (thumbnail && thumbnail.includes("cf.geekdo-images.com")) {
              // Replace _t (tiny) or _mt (micro thumb) suffix with _md (medium)
              thumbnail = thumbnail.replace(/_t(\.\w+)$/, "_md$1")
                                   .replace(/_mt(\.\w+)$/, "_md$1")
                                   .replace(/_s(\.\w+)$/, "_md$1");
            }
          }
          // Fallback: construct thumbnail URL from BGG ID
          if (!thumbnail && bggId) {
            thumbnail = `https://cf.geekdo-images.com/thumb/img/${bggId}`;
          }

          return {
            bggId,
            type,
            title,
            year,
            rank,
            geekRating,
            avgRating,
            numVoters,
            description,
            link,
            thumbnail,
          };
        })
        .filter((r) => r.title);
    });

    log.info(`Found ${results.length} results for "${searchTerm}"`);
    return results;
  } finally {
    await page.close();
  }
}

// ─── Game detail scraper ──────────────────────────────────────────────────────

async function scrapeGameDetail(bggId) {
  const gameUrl = `https://boardgamegeek.com/boardgame/${bggId}`;
  log.info(`Scraping game detail: ${gameUrl}`);

  const browser = await getBrowser();

  // For game detail we DO want images, so we create a special page
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  // Block only media/fonts, allow images
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (["font", "media"].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  page.setDefaultTimeout(CONFIG.timeoutMs);
  page.setDefaultNavigationTimeout(CONFIG.timeoutMs);

  try {
    await page.goto(gameUrl, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.timeoutMs,
    });

    // Wait for the Angular app to render game data
    // Try multiple selectors since BGG updates their markup
    try {
      await page.waitForSelector("h1.game-header-title-heading, .game-header-title, [class*='game-header'] h1", {
        timeout: CONFIG.timeoutMs,
      });
    } catch {
      log.warn(`Title selector not found for ${bggId}, trying page title fallback`);
    }

    // Wait for Angular to finish rendering — check that title doesn't say "Loading"
    await new Promise((r) => setTimeout(r, 3000));

    // Extra wait: poll until the title element has real content
    try {
      await page.waitForFunction(() => {
        const el = document.querySelector("h1.game-header-title-heading, .game-header-title h1, [class*='game-header'] h1");
        return el && el.textContent.trim().length > 0 && !el.textContent.includes("Loading");
      }, { timeout: 15000 });
    } catch {
      log.warn(`Title content still loading for ${bggId}, proceeding anyway`);
    }

    const detail = await page.evaluate((id) => {
      const clean = (s) => (s || "").trim();
      const toFloat = (s) => {
        const n = parseFloat((s || "").replace(/[^\d.]/g, ""));
        return isNaN(n) ? null : n;
      };
      const toInt = (s) => {
        const n = parseInt((s || "").replace(/[^\d]/g, ""), 10);
        return isNaN(n) ? null : n;
      };

      // Title
      const titleEl =
        document.querySelector("h1.game-header-title-heading") ||
        document.querySelector(".game-header-title h1") ||
        document.querySelector("h1[class*='title']");
      const title = titleEl ? clean(titleEl.textContent) : null;

      // Year
      const yearEl = document.querySelector(
        ".game-header-title-year, span[class*='year']"
      );
      const yearMatch = yearEl ? yearEl.textContent.match(/(\d{4})/) : null;
      const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

      // Image - look for the main game image
      const imgEl =
        document.querySelector("img.game-header-image") ||
        document.querySelector(".game-image img") ||
        document.querySelector("img[src*='cf.geekdo-images.com']");
      const image = imgEl ? imgEl.src : null;
      const thumbnail = imgEl ? imgEl.src : null;

      // Rating
      const ratingEl = document.querySelector(
        ".summary-rating-number, [class*='rating-number']"
      );
      const bggRating = ratingEl ? toFloat(ratingEl.textContent) : null;

      // Description
      const descEl =
        document.querySelector(".game-description-body p") ||
        document.querySelector('[class*="description"] p') ||
        document.querySelector(".expandable-text p");
      const description = descEl ? clean(descEl.textContent) : null;

      // Players
      const playersEl = document.querySelector(
        "[class*='players'] .ng-binding, .game-header-body [title*='player']"
      );
      let minPlayers = null,
        maxPlayers = null;
      if (playersEl) {
        const m = playersEl.textContent.match(/(\d+)\s*[–\-]\s*(\d+)|(\d+)/);
        if (m) {
          minPlayers = toInt(m[1] || m[3]);
          maxPlayers = toInt(m[2] || m[3]);
        }
      }

      // Playing time
      const timeEl = document.querySelector(
        "[class*='playing-time'], [title*='minute'], [title*='time']"
      );
      const playingTime = timeEl ? toInt(timeEl.textContent) : null;

      // Weight/complexity
      const weightEl = document.querySelector(
        "[class*='weight'] .weight-votes-average, [class*='complexity']"
      );
      const weight = weightEl ? toFloat(weightEl.textContent) : null;

      return {
        bggId: id,
        title,
        year,
        image,
        thumbnail,
        bggRating,
        description,
        minPlayers,
        maxPlayers,
        playingTime,
        weight,
        link: `https://boardgamegeek.com/boardgame/${id}`,
      };
    }, bggId);

    log.info(`Got detail for bggId ${bggId}: "${detail.title}"`);
    return detail;
  } finally {
    await page.close();
  }
}

// ─── Retry wrapper ───────────────────────────────────────────────────────────

async function withRetry(fn, label) {
  let lastError;
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    log.info(`${label} — attempt ${attempt}/${CONFIG.maxRetries}`);
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      log.error(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt < CONFIG.maxRetries) {
        const delay = attempt * 3000;
        log.warn(`Retrying in ${delay / 1000}s…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function sendJSON(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

async function startServer() {
  // Pre-warm browser
  await getBrowser();
  log.info("Browser warmed up and ready.");

  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const query = parsed.query;

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
      res.end();
      return;
    }

    log.info(`${req.method} ${req.url}`);

    try {
      if (pathname === "/health") {
        sendJSON(res, 200, { status: "ok" });
        return;
      }

      if (pathname === "/search") {
        const q = (query.q || "").trim();
        const type = query.type || "boardgame";

        if (!q) {
          sendJSON(res, 400, { error: "Missing query parameter: q" });
          return;
        }

        const results = await withRetry(
          () => scrapeSearch(q, type),
          `search "${q}"`
        );

        // Normalise to the shape bg-api / frontend expect
        const games = results.map((r) => ({
          id: String(r.bggId),
          name: r.title,
          yearPublished: r.year,
          rank: r.rank,
          bggRating: r.geekRating,
          avgRating: r.avgRating,
          numVoters: r.numVoters,
          description: r.description,
          link: r.link,
          type: r.type,
          thumbnail: r.thumbnail,
        }));

        sendJSON(res, 200, { games });
        return;
      }

      const gameMatch = pathname.match(/^\/game\/(\d+)$/);
      if (gameMatch) {
        const bggId = parseInt(gameMatch[1], 10);
        const detail = await withRetry(
          () => scrapeGameDetail(bggId),
          `game detail ${bggId}`
        );
        sendJSON(res, 200, detail);
        return;
      }

      sendJSON(res, 404, { error: "Not found" });
    } catch (err) {
      log.error(`Request failed: ${err.message}`);
      sendJSON(res, 500, { error: err.message });
    }
  });

  server.listen(CONFIG.port, () => {
    log.info(`BGG Scraper API listening on http://0.0.0.0:${CONFIG.port}`);
    log.info(`  GET /search?q=<term>   → search results`);
    log.info(`  GET /game/:id          → game detail`);
    log.info(`  GET /health            → health check`);
  });
}

// ─── CLI mode ─────────────────────────────────────────────────────────────────

async function runCLI() {
  const args = process.argv.slice(2).filter((a) => a !== "--cli");
  const term = args.join(" ").trim();

  if (!term) {
    process.stderr.write("Usage: bgg-search <game name>\n");
    process.exit(1);
  }

  log.info(`CLI search: "${term}"`);

  try {
    const browser = await getBrowser();
    const results = await withRetry(() => scrapeSearch(term), `search "${term}"`);
    await browser.close();

    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    process.exit(0);
  } catch (err) {
    log.error(`Search failed: ${err.message}`);
    process.exit(1);
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (process.argv.includes("--cli")) {
  runCLI();
} else {
  startServer().catch((err) => {
    log.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });
}
