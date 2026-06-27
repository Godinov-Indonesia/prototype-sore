# =============================================
# Stage 1: Install dependencies
# =============================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# =============================================
# Stage 2: Build the application
# =============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code & config files
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Copy Prisma schema (needed for prisma generate)
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS application
RUN npm run build

# =============================================
# Stage 3: Production runtime
# =============================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install dumb-init for proper signal handling (penting untuk SSE)
# Install postgresql-client untuk auto-enable pgvector extension
RUN apk add --no-cache dumb-init postgresql-client

# Create non-root user for security
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs

# Copy package files & install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema & generate client for production
COPY prisma ./prisma
RUN npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chown -R nestjs:nestjs /app/uploads

# Copy mock data (needed for seeding)
COPY mockData ./mockData

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Set ownership
RUN chown -R nestjs:nestjs /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 5100

# Health check untuk memastikan SSE endpoint tetap responsif
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5100/api || exit 1

# Use dumb-init to handle signals properly (critical untuk SSE long-lived connections)
ENTRYPOINT ["dumb-init", "--"]

# Auto-enable pgvector, migrate, lalu start server
CMD ["sh", "./docker-entrypoint.sh"]
