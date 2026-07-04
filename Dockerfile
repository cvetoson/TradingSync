# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (including lockfiles for reproducible installs)
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies from lockfiles
RUN npm ci
RUN cd backend && npm ci
RUN cd frontend && npm ci

# Copy source and build
COPY . .
RUN cd frontend && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy backend
COPY backend ./backend

# Copy built frontend from builder
COPY --from=builder /app/frontend/dist ./frontend/dist

# Install backend deps only (reproducible, production-only)
WORKDIR /app/backend
RUN npm ci --omit=dev

# Create uploads directory and hand ownership to the built-in non-root "node" user
RUN mkdir -p uploads && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 3001

# Drop root privileges
USER node

CMD ["node", "server.js"]
