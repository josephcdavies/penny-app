FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# Uploads and DB live in named volumes mounted at runtime
RUN mkdir -p uploads db

EXPOSE 3001

CMD ["node", "index.js"]
