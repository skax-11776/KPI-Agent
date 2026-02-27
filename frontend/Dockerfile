# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 먼저 복사 (레이어 캐시 활용)
COPY package.json package-lock.json ./
RUN npm ci

# 소스 복사 후 빌드
COPY . .
RUN npm run build

# Stage 2: Serve (Nginx)
FROM nginx:alpine

# React 빌드 결과물 복사
COPY --from=builder /app/build /usr/share/nginx/html

# React Router 새로고침 대응
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
