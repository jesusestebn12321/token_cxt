ARG NODE_VERSION=24-alpine

# ── Base ────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
WORKDIR /app

# ── Todas las dependencias (build + dev) ────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ── Desarrollo (hot reload; usado por docker-compose.dev.yml) ───
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ── Compilación ─────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Solo dependencias de producción ─────────────────────────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev && npm cache clean --force

# ── Imagen final (producción) ───────────────────────────────────
FROM base AS production
ENV NODE_ENV=production \
    PORT=3000

# La app se ejecuta con `node` directamente: npm/corepack no hacen falta en runtime.
# Quitarlos reduce la superficie de ataque (sus dependencias internas aparecen en los escaneos).
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# Usuario sin privilegios (incluido en la imagen oficial de node)
USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
