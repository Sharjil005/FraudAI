# ---- FraudShield AI :: frontend image ---------------------------------------
# Stage 1 — typecheck and bundle the React app.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
# `npm ci` when a lockfile is present (reproducible), `npm install` otherwise.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build

# ---- Stage 2 — serve the static bundle and proxy /api to the backend --------
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
