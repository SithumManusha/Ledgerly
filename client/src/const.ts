export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Ledgerly is now a fully self-contained local authentication application.
// startLogin opens the LoginDialog in sign-in mode instead of redirecting to an external OAuth gateway.
export const startLogin = () => {
  // Handled via state and LoginDialog in DashboardLayout and App components.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ledgerly:open-login"));
  }
};
