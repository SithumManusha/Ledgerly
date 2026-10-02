import { useState } from "react";
import { Bell, CheckCheck, AlertTriangle, AlertCircle, ArrowUpRight, DollarSign, Users, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

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

function getNotificationIcon(type: string) {
  switch (type) {
    case "ANOMALY":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "BUDGET_WARNING":
      return <AlertCircle className="h-4 w-4 text-rose-500" />;
    case "SETTLEMENT":
      return <DollarSign className="h-4 w-4 text-emerald-500" />;
    case "GROUP":
      return <Users className="h-4 w-4 text-sky-500" />;
    default:
      return <Info className="h-4 w-4 text-slate-500" />;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 15000, // Poll every 15s for real-time responsiveness
  });

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
    },
  });

  const markAllAsRead = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleNotificationClick = (id: string, link?: string) => {
    markAsRead.mutate({ id });
    if (link) {
      setLocation(link);
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 shadow-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="h-7 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-slate-500">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">All caught up!</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Zero alerts require attention.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n.id, n.link)}
                className={`p-3.5 transition-colors cursor-pointer flex gap-3 items-start ${
                  n.isRead
                    ? "bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-75"
                    : "bg-emerald-50/40 hover:bg-emerald-50/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
                }`}
              >
                <div className="mt-0.5 p-1.5 rounded-md bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                  {getNotificationIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs font-semibold truncate ${n.isRead ? "text-slate-800 dark:text-slate-200" : "text-slate-950 dark:text-white"}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                  {n.link && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 hover:underline">
                      View details <ArrowUpRight className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                {!n.isRead && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
