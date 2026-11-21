FROM node:20-slim AS base

# Install OpenSSL for Prisma ORM engine compatibility
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests & Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Generate Prisma client and build Next.js production bundle
RUN npx prisma generate
RUN npm run build

# Configure runtime environment for Hugging Face Spaces
ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME="0.0.0.0"

# Set permissions for non-root user (node has UID 1000, standard for Hugging Face Spaces)
RUN chown -R node:node /app
USER node

EXPOSE 7860

CMD ["npm", "start"]
