import { broadcastGroupEvent } from "./realtimeEvents";

export interface AuditActivity {
  id: string;
  groupId: number;
  userId?: number;
  actorName: string;
  action: "BILL_RECORDED" | "AI_SPLIT_APPLIED" | "PAYMENT_EVIDENCE" | "SETTLEMENT_VERIFIED" | "MEMBER_JOINED" | "BUDGET_GUARDRAIL";
  title: string;
  description: string;
  amountCents?: number;
  evidenceUrl?: string;
  timestamp: string;
}

const auditStore: Map<number, AuditActivity[]> = new Map();

/**
 * Seed realistic audit trail for a group if empty
 */
export function seedDefaultGroupActivities(groupId: number) {
  if (auditStore.has(groupId) && (auditStore.get(groupId)?.length ?? 0) > 0) {
    return;
  }

  const defaultEvents: AuditActivity[] = [
    {
      id: "act-1",
      groupId,
      actorName: "Sithum Manusha",
      action: "SETTLEMENT_VERIFIED",
      title: "Settlement Verified & Closed",
      description: "Confirmed bank deposit from Amal Fernando (Ref #SP-2026-8821).",
      amountCents: 1000000,
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 mins ago
    },
    {
      id: "act-2",
      groupId,
      actorName: "Kasun Perera",
      action: "PAYMENT_EVIDENCE",
      title: "Bank Slip Attached",
      description: "Uploaded transfer receipt for Villa settlement (Ref #CB998273).",
      amountCents: 2200000,
      evidenceUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    },
    {
      id: "act-3",
      groupId,
      actorName: "AI Smart Assistant",
      action: "AI_SPLIT_APPLIED",
      title: "4-Way Occupancy Allocation",
      description: "Processed natural language prompt: Sunil 30 days, Nimal 15 days split.",
      amountCents: 3000000,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    },
    {
      id: "act-4",
      groupId,
      actorName: "Sithum Manusha",
      action: "BILL_RECORDED",
      title: "Beachfront 4-Bedroom Villa",
      description: "Recorded primary lodging accommodation with 4 equal shares.",
      amountCents: 8400000,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
    {
      id: "act-5",
      groupId,
      actorName: "Amal Fernando",
      action: "MEMBER_JOINED",
      title: "Member Joined Group",
      description: "Joined via secure cryptographic token link.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    },
  ];

  auditStore.set(groupId, defaultEvents);
}

export function getGroupActivities(groupId: number): AuditActivity[] {
  seedDefaultGroupActivities(groupId);
  return auditStore.get(groupId) ?? [];
}

export function logGroupActivity(groupId: number, input: Omit<AuditActivity, "id" | "groupId" | "timestamp">): AuditActivity {
  const current = auditStore.get(groupId) ?? [];
  const newActivity: AuditActivity = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    groupId,
    actorName: input.actorName,
    action: input.action,
    title: input.title,
    description: input.description,
    amountCents: input.amountCents,
    evidenceUrl: input.evidenceUrl,
    timestamp: new Date().toISOString(),
  };

  current.unshift(newActivity);
  auditStore.set(groupId, current);

  // Broadcast real-time event to SSE subscribers
  broadcastGroupEvent(groupId, "ACTIVITY_LOGGED", newActivity);

  return newActivity;
}
