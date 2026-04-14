#!/usr/bin/env node
/**
 * bgg-search — CLI tool for searching BoardGameGeek
 *
 * Usage:
 *   bgg-search catan
 *   bgg-search terraforming mars
 *   bgg-search "spirit island"
 *
 * If the scraper service is running (docker compose up), it proxies
 * through the API for a fast response. Otherwise it falls back to
 * running Puppeteer directly (requires Node + chromium locally).
 *
 * Install globally:
 *   npm install -g .     (from inside the bgg-scraper directory)
 * Or run directly:
 *   node bgg-search.js catan
 */

"use strict";

const http = require("http");

const SCRAPER_HOST = process.env.BGG_SCRAPER_HOST || "localhost";
const SCRAPER_PORT = parseInt(process.env.BGG_SCRAPER_PORT || "3002", 10);

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: bgg-search <game name>");
  console.error("       bgg-search catan");
  console.error("       bgg-search terraforming mars");
  process.exit(1);
}

const query = args.join(" ").trim();

function httpGet(host, port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Invalid JSON response"));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Connection timed out"));
    });
  });
}

function formatResult(game, i) {
  const rank = game.rank ? `#${game.rank}` : "   ";
  const year = game.year || game.yearPublished ? `(${game.year || game.yearPublished})` : "";
  const rating = game.geekRating || game.bggRating
    ? `★ ${(game.geekRating || game.bggRating).toFixed(2)}`
    : "";
  const voters = game.numVoters ? `${game.numVoters.toLocaleString()} votes` : "";
  const type = game.type && game.type !== "boardgame" ? ` [${game.type}]` : "";

  const title = `${game.title || game.name}${type} ${year}`.trim();
  const meta = [rank, rating, voters].filter(Boolean).join("  ");
  const desc = game.description ? `  ${game.description.slice(0, 80)}…` : "";

  return `${String(i + 1).padStart(3)}. ${title}\n     ${meta}${desc ? "\n" + desc : ""}`;
}

async function main() {
  process.stderr.write(`Searching BGG for: "${query}"\n`);

  let data;
  try {
    // Try hitting the running service first
    data = await httpGet(
      SCRAPER_HOST,
      SCRAPER_PORT,
      `/search?q=${encodeURIComponent(query)}`
    );
    process.stderr.write(`(via scraper service at ${SCRAPER_HOST}:${SCRAPER_PORT})\n\n`);
  } catch (serviceErr) {
    process.stderr.write(
      `Scraper service not available (${serviceErr.message}), falling back to direct scrape…\n\n`
    );
    // Fall back to running Puppeteer directly
    const { execSync } = require("child_process");
    const scriptPath = require("path").join(__dirname, "index.js");
    const env = {
      ...process.env,
      BGG_SEARCH_TERM: query,
    };
    const output = execSync(`node "${scriptPath}" --cli`, {
      env,
      timeout: 120000,
    });
    data = JSON.parse(output.toString());
  }

  const games = data.games || data; // service returns {games:[]} or raw array
  if (!games || !games.length) {
    console.log(`No results found for "${query}"`);
    process.exit(0);
  }

  console.log(`Found ${games.length} results for "${query}":\n`);
  games.forEach((g, i) => console.log(formatResult(g, i)));
  console.log("\n" + "-".repeat(60));
  console.log(`Tip: View details at https://boardgamegeek.com`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
