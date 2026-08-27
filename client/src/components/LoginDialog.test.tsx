// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginDialog } from "./LoginDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/lib/trpc";

import superjson from "superjson";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "http://localhost:3000/api/trpc",
      transformer: superjson,
    }),
  ],
});

function renderWithTrpc(ui: React.ReactElement) {
  return render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </trpc.Provider>,
  );
}

describe("LoginDialog local authentication stages", () => {
  afterEach(() => cleanup());
  it("exposes local sign-in email, password inputs, and account creation link", () => {
    const onLogin = vi.fn();

    renderWithTrpc(
      <LoginDialog
        open
        title="Welcome to Ledgerly"
        onLogin={onLogin}
      />,
    );

    const emailInput = screen.getByLabelText("Email address");
    const passwordInput = screen.getByLabelText("Password");
    const signinBtn = screen.getByRole("button", { name: "Sign in" });

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(signinBtn).toBeInTheDocument();
    expect(signinBtn.className).toContain("w-full");

    const createAccBtn = screen.getByRole("button", { name: "New to Ledgerly? Create an account" });
    expect(createAccBtn).toBeInTheDocument();
  });

  it("switches to the registration form when the create-account action is clicked", () => {
    const onLogin = vi.fn();

    renderWithTrpc(<LoginDialog open onLogin={onLogin} />);

    fireEvent.click(screen.getByRole("button", { name: "New to Ledgerly? Create an account" }));

    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Already have an account? Sign in" })).toBeInTheDocument();
  });

  it("can open directly in registration mode and validates required details", async () => {
    const onLogin = vi.fn();

    renderWithTrpc(<LoginDialog open initialMode="register" onLogin={onLogin} />);

    expect(screen.getByRole("heading", { name: "Create your Ledgerly account" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter your name, email, and password.");
    expect(onLogin).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Sithum Appuhamy" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sithum@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "securepassword123" } });
    await waitFor(() => {
      expect(screen.getByLabelText("Full name")).toHaveValue("Sithum Appuhamy");
      expect(screen.getByLabelText("Email address")).toHaveValue("sithum@example.com");
      expect(screen.getByLabelText("Password")).toHaveValue("securepassword123");
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    onLogin();
  });

  it("shows password strength feedback during registration", () => {
    renderWithTrpc(<LoginDialog open initialMode="register" onLogin={vi.fn()} />);

    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "StrongerPassword123!" } });

    expect(screen.getByRole("progressbar", { name: "Password strength: Strong" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("opens automatic email recovery from sign in", () => {
    renderWithTrpc(<LoginDialog open onLogin={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));

    expect(screen.getByRole("heading", { name: "Recover your Ledgerly account" })).toBeInTheDocument();
    expect(screen.getByText(/send a one-time password-reset link/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Account email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I have a recovery token" })).toBeInTheDocument();
  });

  it("opens the reset form and shows a second password strength meter", () => {
    renderWithTrpc(<LoginDialog open onLogin={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
    fireEvent.click(screen.getByRole("button", { name: "I have a recovery token" }));

    expect(screen.getByRole("heading", { name: "Set a new Ledgerly password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Recovery token")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByText("Password strength")).toBeInTheDocument();
  });
});
