import { PrismaClient } from "@prisma/client";
import { config } from "../config";

declare global {
  // Prevent multiple Prisma instances in development hot-reload
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: config.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (config.NODE_ENV === "development") {
  globalThis.__prisma = prisma;
}
