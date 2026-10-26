export interface AppendAuditInput {
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}
