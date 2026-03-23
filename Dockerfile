# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# VITE_API_BASE_URL — переопределяется в Railway через build variable.
# По умолчанию /api/v1 → nginx-proxy (для docker-compose).
# Для Railway set: VITE_API_BASE_URL=https://backend.railway.app/api/v1
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# nginx native template support — auto-runs envsubst on *.template files at startup
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

# Default backend — overridden in Railway/production via env var
ENV PORT=80
ENV BACKEND_URL=http://backend:8000

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
