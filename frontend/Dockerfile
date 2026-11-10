# syntax=docker/dockerfile:1

# ---------- build the static app ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---------- serve with nginx as a non-root user (uid 101) ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV API_URL=http://localhost:8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 nginx/05-validate-api-url.sh /docker-entrypoint.d/05-validate-api-url.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
