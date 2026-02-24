# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies
RUN npm install
RUN cd backend && npm install
RUN cd frontend && npm install

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

# Install backend deps only
WORKDIR /app/backend
RUN npm install --omit=dev

# Create uploads directory
RUN mkdir -p uploads

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
