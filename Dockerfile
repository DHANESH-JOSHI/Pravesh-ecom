# 1️⃣ Builder stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (dev + prod)
RUN bun install --frozen-lockfile

# Copy app source code
COPY . .

# Build the app (TypeScript → JS, or any build script)
RUN bun run build

# 2️⃣ Runner stage
FROM oven/bun:1 AS runner

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist

# Copy package files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./

# Install only production dependencies
RUN bun install --production

# Copy any other needed files (e.g., .env)
COPY --from=builder /app/.env.example ./.env

# Expose the app port
EXPOSE 3000

# Start the app
CMD ["bun", "run", "start"]
