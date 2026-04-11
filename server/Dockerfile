# Stage 1: Build React client
FROM node:20-alpine AS client-build
WORKDIR /client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Run server
# WORKDIR is /app/server so that ../client/dist matches the dev path convention
FROM node:20-alpine
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-build /client/dist /app/client/dist

# Uploads and DB live in named volumes mounted at runtime
RUN mkdir -p uploads db

EXPOSE 3001

CMD ["node", "index.js"]
