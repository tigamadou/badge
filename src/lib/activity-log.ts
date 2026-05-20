import { prisma } from "./prisma";
import type { ActivityType, Prisma } from "@prisma/client";
import { headers } from "next/headers";

interface LogActivityParams {
  type: ActivityType;
  userId?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
  req?: Request | null;
}

export async function logActivity({ type, userId, targetId, details, req }: LogActivityParams): Promise<void> {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (req) {
      userAgent = req.headers.get("user-agent") || null;
      ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || null;
    } else {
      try {
        const h = await headers();
        userAgent = h.get("user-agent") || null;
        ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim()
          || h.get("x-real-ip")
          || null;
      } catch {
        // headers() not available outside request context
      }
    }

    await prisma.activityLog.create({
      data: {
        type,
        ...(userId ? { user: { connect: { id: userId } } } : {}),
        targetId: targetId ?? null,
        details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("[ActivityLog] Erreur lors de l'enregistrement:", error);
  }
}
