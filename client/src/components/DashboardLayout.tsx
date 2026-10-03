import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ArrowRight,
  BarChart3,
  FileSpreadsheet,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  PanelLeft,
  ReceiptText,
  Repeat2,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { getThemeToggleLabel, useTheme } from "../contexts/ThemeContext";
import { Button } from "./ui/button";
import { LoginDialog } from "./LoginDialog";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: ReceiptText, label: "Transactions", path: "/transactions" },
  { icon: WalletCards, label: "Budgets", path: "/budgets" },
  { icon: Repeat2, label: "Recurring", path: "/recurring" },
  { icon: Sparkles, label: "AI Copilot", path: "/copilot", isAi: true },
  { icon: BarChart3, label: "Insights", path: "/insights" },
  { icon: Users, label: "Shared Groups", path: "/shared" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [location] = useLocation();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    if (location === "/login" || location.startsWith("/login")) {
      setAuthMode("signin");
      setAuthDialogOpen(true);
    }
  }, [location]);

  useEffect(() => {
    const handleOpenLogin = () => {
      setAuthMode("signin");
      setAuthDialogOpen(true);
    };
    window.addEventListener("ledgerly:open-login", handleOpenLogin);
    return () => {
      window.removeEventListener("ledgerly:open-login", handleOpenLogin);
    };
  }, []);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  const isLoginRoute = location === "/login" || location.startsWith("/login");

  if (!user || isLoginRoute) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/15 via-slate-500/5 to-transparent pointer-events-none dark:from-emerald-600/20 dark:via-background dark:to-background" />
        <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-slate-900 text-white shadow-xl shadow-emerald-500/25 ring-1 ring-emerald-300/40 dark:ring-emerald-400/40">
            <WalletCards className="h-8 w-8 text-white" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-xs backdrop-blur-md mb-4 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Full-Stack Personal Finance & Collaborative Ledger
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Ledgerly Workspace
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            Portfolio-grade expense tracking, multi-currency conversion, predictive analytics, and collaborative bill splitting engineered with React 19 & tRPC.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 max-w-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-2xs backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Bank-Grade Bcrypt</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-2xs backdrop-blur-sm">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>End-to-End Type-Safe</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-2xs backdrop-blur-sm">
              <FileSpreadsheet className="h-3.5 w-3.5 text-sky-500" />
              <span>CSV & PDF Export</span>
            </div>
          </div>

          <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
            <Button
              onClick={() => {
                setAuthMode("signin");
                setAuthDialogOpen(true);
              }}
              size="lg"
              className="group h-12 w-full rounded-xl bg-slate-900 text-base font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all hover:shadow-slate-900/30 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white"
            >
              <LogIn className="mr-2 h-4 w-4" />
              <span>Sign in to Ledgerly</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                setAuthDialogOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>New to Ledgerly? Create an account</span>
            </button>
          </div>

          <div className="mt-12 grid w-full max-w-3xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 border-t border-border pt-8 text-left">
            <div className="group rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs backdrop-blur-sm transition-all hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-300 transition-transform group-hover:scale-110">
                <BarChart3 className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-foreground">Analytics & Rhythm</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">3-month trajectories, daily burn rate & 30-day rhythm distributions.</p>
            </div>
            <div className="group rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs backdrop-blur-sm transition-all hover:border-teal-400 hover:shadow-md hover:-translate-y-0.5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 shadow-xs dark:bg-teal-500/20 dark:text-teal-300 transition-transform group-hover:scale-110">
                <Repeat2 className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-foreground">Recurring Commitments</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Subscription models, savings runway & budget threshold guardrails.</p>
            </div>
            <div className="group rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs backdrop-blur-sm transition-all hover:border-sky-400 hover:shadow-md hover:-translate-y-0.5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 border border-sky-500/20 shadow-xs dark:bg-sky-500/20 dark:text-sky-300 transition-transform group-hover:scale-110">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-foreground">Group Bill Splits</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Roommate settlements by occupancy or equal, with PDF export.</p>
            </div>
            <div className="group rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs backdrop-blur-sm transition-all hover:border-violet-400 hover:shadow-md hover:-translate-y-0.5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 border border-violet-500/20 shadow-xs dark:bg-violet-500/20 dark:text-violet-300 transition-transform group-hover:scale-110">
                <ScanLine className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-foreground">AI OCR & Security</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Smart receipt scanning, multi-currency & Bcrypt encryption.</p>
            </div>
          </div>
        </div>
        <LoginDialog
          open={authDialogOpen}
          initialMode={authMode}
          onOpenChange={setAuthDialogOpen}
          onLogin={startLogin}
        />
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-5 w-5 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate text-sidebar-foreground">
                    Ledgerly
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            <SidebarMenu className="px-2 py-1 gap-3">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-11 px-3 text-sm font-medium gap-3.5 transition-all rounded-lg [&>svg]:!size-[22px] [&>svg]:!shrink-0 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
                    >
                      <item.icon
                        className={`!size-[22px] shrink-0 transition-colors ${isActive ? "text-primary stroke-[2.2]" : "text-muted-foreground stroke-[1.8]"}`}
                      />
                      <span className="text-[14px] flex-1 text-left">{item.label}</span>
                      {item.isAi && !isCollapsed && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/20 shadow-xs">
                          AI
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="gap-3 p-3">
            <button
              type="button"
              onClick={() => toggleTheme?.()}
              aria-label={getThemeToggleLabel(theme)}
              aria-pressed={theme === "dark"}
              className="flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center"
            >
              {theme === "dark" ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
              <span className="group-data-[collapsible=icon]:hidden">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex h-14 items-center justify-between border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Ledgerly"}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggleTheme?.()}
              aria-label={getThemeToggleLabel(theme)}
              aria-pressed={theme === "dark"}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
