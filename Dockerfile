# Stage 1: Build Frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
RUN npm ci --only=production

COPY backend/ ./backend/
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

EXPOSE 4000

CMD ["node", "backend/src/server.js"]
