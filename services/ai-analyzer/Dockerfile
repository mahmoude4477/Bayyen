FROM node:24-alpine

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY packages/contracts ./packages/contracts
COPY services/ai-analyzer ./services/ai-analyzer

EXPOSE 8020
CMD ["pnpm", "exec", "tsx", "services/ai-analyzer/src/server.ts"]
