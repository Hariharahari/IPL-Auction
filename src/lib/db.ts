import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Helper to safely run DB operations with a graceful fallback if DATABASE_URL
 * is not configured or during offline dev mode.
 */
export async function safeDbOperation<T>(
  operation: (client: PrismaClient) => Promise<T>,
  fallbackValue: T
): Promise<T> {
  if (!process.env.DATABASE_URL) {
    return fallbackValue;
  }
  try {
    return await operation(prisma);
  } catch (err) {
    console.warn('[Database] Safe fallback triggered:', err instanceof Error ? err.message : err);
    return fallbackValue;
  }
}
