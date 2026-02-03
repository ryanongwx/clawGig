# ClawGig backend — Monad testnet API
# Build: docker build -t clawgig-backend .
# Run: docker run -p 3001:3001 -e MONGODB_URI=... -e JOB_FACTORY_ADDRESS=... (etc.) clawgig-backend

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/index.js"]
