# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – install Node dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – runtime with system Chromium
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# ── System Chromium + dependencies ───────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# ── Non-root user ────────────────────────────────────────────────────────────
RUN groupadd --system scraper && useradd --system --gid scraper scraper

WORKDIR /app

# ── Copy node modules from deps stage ────────────────────────────────────────
COPY --from=deps /app/node_modules ./node_modules

# ── Copy app ──────────────────────────────────────────────────────────────────
COPY index.js bgg-search.js ./

# ─────────────────────────────────────────────────────────────────────────────
# Environment
# ─────────────────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV XDG_CONFIG_HOME=/tmp/.config
ENV PUPPETEER_DISABLE_CRASH_DUMPS=true
ENV PORT=3002

# ─────────────────────────────────────────────────────────────────────────────
# Permissions
# ─────────────────────────────────────────────────────────────────────────────
RUN mkdir -p /tmp/.cache /tmp/.config && \
    chown -R scraper:scraper /app /tmp

USER scraper

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
