import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

export async function writeAudit(opts: {
  action: string;
  entityType?: string;
  entityId?: string;
  ip?: string;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    const db = getDb();
    if (!db) {
      console.info("[audit:mock]", opts.action, opts.entityType, opts.entityId);
      return;
    }
    await db.insert(auditLogs).values({
      action: opts.action,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      meta: opts.meta ?? null,
    });
  } catch (e) {
    // Never fail login / mutations if audit_logs is missing or broken
    console.warn(
      "[audit:skip]",
      opts.action,
      e instanceof Error ? e.message : "unknown"
    );
  }
}
