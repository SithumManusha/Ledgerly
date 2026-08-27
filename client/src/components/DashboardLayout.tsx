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
import { BarChart3, LayoutDashboard, LogOut, Moon, PanelLeft, ReceiptText, Sun, Users, WalletCards } from "lucide-react";
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
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

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

  if (!user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/15 via-background to-transparent pointer-events-none dark:from-indigo-600/20 dark:via-background dark:to-background" />
        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-cyan-500 text-white shadow-xl shadow-indigo-500/25 ring-1 ring-indigo-300/40 dark:ring-indigo-400/40">
            <WalletCards className="h-8 w-8 text-white" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/90 px-3.5 py-1 text-xs font-semibold text-indigo-800 shadow-xs backdrop-blur-md mb-4 dark:border-indigo-900/60 dark:bg-indigo-950/60 dark:text-indigo-300">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            AI-Guided Private Personal Finance
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Ledgerly Workspace
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Portfolio-grade expense tracking, multi-currency conversion, secure local authentication, and intelligent receipt scanning designed for professional clarity.
          </p>

          <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
            <Button
              onClick={() => {
                setAuthMode("signin");
                setAuthDialogOpen(true);
              }}
              size="lg"
              className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 transition-all hover:shadow-indigo-500/35 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white"
            >
              Sign in to Ledgerly
            </Button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                setAuthDialogOpen(true);
              }}
              className="py-2 text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              New to Ledgerly? Create an account
            </button>
          </div>

          <div className="mt-12 grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-3 border-t border-border pt-6 text-left">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm backdrop-blur-sm transition-all hover:border-indigo-400 hover:shadow-md">
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">AI Scanning</p>
              <p className="mt-1 text-xs sm:text-[11px] text-muted-foreground">Batch receipt parsing & category suggestion.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm backdrop-blur-sm transition-all hover:border-indigo-400 hover:shadow-md">
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Multi-Currency</p>
              <p className="mt-1 text-xs sm:text-[11px] text-muted-foreground">Foreign exchange splitting & conversion.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm backdrop-blur-sm transition-all hover:border-indigo-400 hover:shadow-md">
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Secure Local</p>
              <p className="mt-1 text-xs sm:text-[11px] text-muted-foreground">Bcrypt sessions & recovery token flow.</p>
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
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
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

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="gap-2 p-3">
            <button
              type="button"
              onClick={() => toggleTheme?.()}
              aria-label={getThemeToggleLabel(theme)}
              aria-pressed={theme === "dark"}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
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
