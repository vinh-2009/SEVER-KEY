FROM node:24-alpine

WORKDIR /app

# Cài đặt dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Sao chép mã nguồn
COPY . .

# Mở cổng
EXPOSE 3000

ENV PORT=3000
ENV ADMIN_TOKEN=admin_secret_key_123

# Khởi chạy server
CMD ["node", "src/server.js"]
