# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml .npmrc ./
# Le jeton du registre est un secret de build : il n'existe que pendant cette
# commande et n'est ecrit dans aucune couche de l'image.
RUN --mount=type=secret,id=npm_token \
    export NPM_TOKEN="$(cat /run/secrets/npm_token)" && (yarn install || yarn install)

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# .npmrc est copie avec les sources : yarn exige que NPM_TOKEN soit defini (vide ici,
# le jeton reel n'est necessaire qu'a l'installation).
ENV NPM_TOKEN=
RUN yarn prisma generate --schema=./prisma/schema.prisma
RUN yarn build
# Worker d'emails (spec 23) : bundle unique lance par `node worker.cjs` dans l'image runner.
RUN yarn build:worker

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Full CLI dependency tree (incl. effect, c12, …); selective COPY of prisma/* omits hoisted peers.
RUN npm install -g prisma@6.19.3

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/build/worker.cjs ./worker.cjs

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
