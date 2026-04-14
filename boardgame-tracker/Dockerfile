# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – build the React app
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – serve with nginx
# Nginx serves the static files AND proxies /api → bg-api:3001
# so the frontend's relative /api calls work the same as in dev.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
