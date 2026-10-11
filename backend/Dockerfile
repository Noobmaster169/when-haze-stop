# syntax=docker/dockerfile:1
#
# One image for the api, the hourly jobs and the migration step of compose.yaml;
# each service picks its command. TypeScript runs through tsx, as `pnpm start`
# does, so there is no build step and tsx stays a dependency of the image.

FROM node:24-slim

# The version package.json pins. npm rather than corepack, whose bundled
# signing keys lag behind new pnpm releases.
RUN npm install -g pnpm@11.20.0 && npm cache clean --force

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY db ./db
COPY src ./src

# Production after the install, which needs the dev dependencies (tsx). It
# turns off pino-pretty, so logs are JSON lines.
ENV NODE_ENV=production
USER node

EXPOSE 8091
CMD ["node", "--import", "tsx", "src/index.ts"]
