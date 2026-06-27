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
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# =============================================
# Stage 3: Production runtime
# =============================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 discordbot && \
    adduser --system --uid 1001 discordbot

# Copy package files & install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R discordbot:discordbot /app

# Switch to non-root user
USER discordbot

# Use dumb-init to handle signals properly (graceful shutdown untuk Discord bot)
ENTRYPOINT ["dumb-init", "--"]

# Start the bot
CMD ["node", "dist/index.js"]
