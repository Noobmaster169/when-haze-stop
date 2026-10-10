# syntax=docker/dockerfile:1
#
# The Next.js app as the `frontend` service of compose.yaml: a production build,
# served by `next start`. BACKEND_URL is read at request time on the server,
# so the same image serves whatever backend compose names.

FROM node:24-slim

# The version package.json pins. npm rather than corepack, whose bundled
# signing keys lag behind new pnpm releases.
RUN npm install -g pnpm@11.20.0 && npm cache clean --force

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production
USER node

EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
