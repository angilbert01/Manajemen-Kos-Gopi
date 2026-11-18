FROM node:22-slim

WORKDIR /app

# Install seluruh dependency terlebih dahulu (memanfaatkan cache layer Docker)
COPY package*.json ./
RUN npm ci

# Salin source code lalu build frontend produksi (dist/)
COPY . .
RUN npm run build

# Pastikan direktori data untuk SQLite tersedia (bisa di-mount sebagai volume)
RUN mkdir -p /app/server/data

ENV HOST=0.0.0.0
ENV PORT=3001
ENV TZ=Asia/Jakarta

EXPOSE 3001

# Jalankan server Express (API + UI statis dist/ + Chatbot Telegram)
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]

