// A representative "before" Dockerfile used as the default input and in tests.
// It intentionally contains the two headline problems Layerlens detects:
// a broad `COPY . .` before `npm ci`, and an apt install without cleanup.
export const SAMPLE_DOCKERFILE = `# syntax=docker/dockerfile:1
FROM node:18-slim

RUN apt-get update && apt-get install -y curl git

WORKDIR /app

# Bug: copying everything before installing busts the cache on every edit.
COPY . .

RUN npm ci --production

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
`;
