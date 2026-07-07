# ── Stage 1: build the Vite React app ────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install deps (cached unless package files change)
COPY package.json package-lock.json* ./
RUN npm install

# Build. VITE_API_BASE can be overridden at build time for non-localhost deploys.
ARG VITE_API_BASE=http://localhost:8080
ENV VITE_API_BASE=$VITE_API_BASE
COPY . .
RUN npm run build

# ── Stage 2: serve static build with nginx ───────────────────────────────────
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
