import { useEffect } from "react";
import { History, Receipt, Bot, CreditCard, ShieldCheck, UserPlus, ExternalLink, Activity } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/lib/formatters";

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getActionBadge(action: string) {
  switch (action) {
    case "BILL_RECORDED":
      return (
        <Badge variant="secondary" className="bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-0 flex items-center gap-1 text-[10px]">
          <Receipt className="h-3 w-3" /> Bill Recorded
        </Badge>
      );
    case "AI_SPLIT_APPLIED":
      return (
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 flex items-center gap-1 text-[10px]">
          <Bot className="h-3 w-3" /> AI Split Applied
        </Badge>
      );
    case "PAYMENT_EVIDENCE":
      return (
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-0 flex items-center gap-1 text-[10px]">
          <CreditCard className="h-3 w-3" /> Payment Slip
        </Badge>
      );
    case "SETTLEMENT_VERIFIED":
      return (
        <Badge variant="secondary" className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-0 flex items-center gap-1 text-[10px]">
          <ShieldCheck className="h-3 w-3" /> Debt Settled
        </Badge>
      );
    case "MEMBER_JOINED":
      return (
        <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-0 flex items-center gap-1 text-[10px]">
          <UserPlus className="h-3 w-3" /> Member Joined
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-0 text-[10px]">
          Activity
        </Badge>
      );
  }
}

export function GroupAuditTimeline({ groupId }: { groupId: number }) {
  const utils = trpc.useUtils();
  const { data: activities = [], isLoading } = trpc.shared.getActivityStream.useQuery(
    { groupId },
    { refetchInterval: 12000 }
  );

  // Subscribe to real-time Server-Sent Events (SSE)
  useEffect(() => {
    if (!groupId) return;
    const eventSource = new EventSource(`/api/events?groupId=${groupId}`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "ACTIVITY_LOGGED" || payload.type === "BILL_ADDED" || payload.type === "SETTLEMENT_UPDATED") {
          utils.shared.getActivityStream.invalidate({ groupId });
          utils.shared.settlement.invalidate({ groupId });
          utils.shared.bills.invalidate({ groupId });
        }
      } catch {
        // ignore non-json pings
      }
    };

    return () => {
      eventSource.close();
    };
  }, [groupId, utils]);

  return (
    <Card className="border-0 bg-white dark:bg-slate-900 shadow-[0_10px_30px_rgba(25,35,25,0.06)]">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-800">
              <History className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                Live Activity Audit Stream
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Immutable chronological log of all shared bills, AI split allocations, and bank settlement transfers.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Live Sync Active</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-slate-500">Loading audit trail...</div>
        ) : activities.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No activity logged for this group yet.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {activities.map((act) => (
              <div key={act.id} className="relative group">
                {/* Node indicator */}
                <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-sm" />

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {act.actorName}
                    </span>
                    {getActionBadge(act.action)}
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {act.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                    {formatRelativeTime(act.timestamp)}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {act.description}
                </p>

                <div className="flex items-center gap-3 mt-1.5">
                  {act.amountCents && act.amountCents > 0 && (
                    <span className="text-xs font-semibold text-slate-900 dark:text-emerald-400">
                      {formatMoney(act.amountCents)}
                    </span>
                  )}
                  {act.evidenceUrl && (
                    <a
                      href={act.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline"
                    >
                      <Receipt className="h-3 w-3" /> View Deposit Evidence <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
