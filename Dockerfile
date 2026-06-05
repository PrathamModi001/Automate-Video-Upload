# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package configuration files
COPY package.json package-lock.json ./

# Install all dependencies (including TypeScript and build tools)
RUN npm ci

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Compile the TypeScript code
RUN npm run build

# Stage 2: Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set node environment to production
ENV NODE_ENV=production

# Copy package configuration files
COPY package.json package-lock.json ./

# Install only production dependencies (excluding TypeScript devDependencies)
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript from the builder stage
COPY --from=builder /app/dist ./dist

# Create default directories for uploads and backups
RUN mkdir -p uploads backup_videos

# Run the worker script
CMD ["node", "dist/worker.js"]
