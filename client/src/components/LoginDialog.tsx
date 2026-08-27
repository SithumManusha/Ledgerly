import React, { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  passwordStrengthForRegistration,
  passwordStrengthForReset,
  passwordPolicyMessage,
  type PasswordStrengthIndicatorData,
} from "@shared/password";

type AuthMode = "signin" | "register" | "forgot" | "reset";

interface LoginDialogProps {
  title?: string;
  logo?: string;
  open?: boolean;
  initialMode?: Exclude<AuthMode, "forgot" | "reset">;
  onLogin: () => void;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  visible,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-[#34322d] dark:text-zinc-200">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-10 bg-white pr-11 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-[#858481] transition-colors hover:text-[#34322d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a19] dark:text-zinc-500 dark:hover:text-zinc-200 dark:focus-visible:ring-zinc-200"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function PasswordStrengthMeter({
  password,
  purpose,
}: {
  password: string;
  purpose: "registration" | "reset";
}) {
  const strength: PasswordStrengthIndicatorData = useMemo(
    () => (purpose === "registration" ? passwordStrengthForRegistration(password) : passwordStrengthForReset(password)),
    [password, purpose],
  );

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-[#858481] dark:text-zinc-400">Password strength</span>
        <span className={`font-medium ${strength.textClass}`}>{strength.label}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Password strength: ${strength.label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={strength.percent}
        className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        {[0, 1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={`h-full flex-1 rounded-full transition-colors ${segment < strength.score ? strength.colorClass : "bg-transparent"}`}
          />
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-[#858481] dark:text-zinc-400">{strength.hint}</p>
    </div>
  );
}

export function LoginDialog({
  title,
  logo,
  open = false,
  initialMode = "signin",
  onLogin,
  onOpenChange,
  onClose,
}: LoginDialogProps) {
  const [internalOpen, setInternalOpen] = useState(open);
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [isRequestingRecovery, setIsRequestingRecovery] = useState(false);

  const [recoveryToken, setRecoveryToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setIsSigningIn(false);
      handleOpenChange(false);
      onLogin();
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      setIsSigningIn(false);
      setSignInError(err.message || "Invalid email or password.");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setIsRegistering(false);
      handleOpenChange(false);
      onLogin();
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      setIsRegistering(false);
      setRegError(err.message || "Registration failed. Please try again.");
    },
  });

  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const forgotPasswordMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: (result) => {
      setIsRequestingRecovery(false);
      setRecoveryError("");
      setRecoveryMessage(result.message);
      if (result.resetToken) {
        setGeneratedToken(result.resetToken);
      }
    },
    onError: (err) => {
      setIsRequestingRecovery(false);
      setRecoveryError(err.message || "Recovery request could not be completed.");
    },
  });

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setIsResettingPassword(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      handleOpenChange(false);
      onLogin();
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      setIsResettingPassword(false);
      setResetError(err.message || "The recovery token could not be used.");
    },
  });

  useEffect(() => {
    if (!onOpenChange) setInternalOpen(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [initialMode, open]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reset_token");
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) return;
    setRecoveryToken(token);
    setResetError("");
    setMode("reset");
    if (onOpenChange) onOpenChange(true);
    else setInternalOpen(true);
  }, [onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) onOpenChange(nextOpen);
    else setInternalOpen(nextOpen);

    if (!nextOpen) {
      setMode("signin");
      setSignInEmail("");
      setSignInPassword("");
      setShowSignInPassword(false);
      setSignInError("");
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setShowRegPassword(false);
      setRegError("");
      setRecoveryEmail("");
      setRecoveryMessage("");
      setRecoveryError("");
      setRecoveryToken("");
      setResetPassword("");
      setShowResetPassword(false);
      setResetError("");
      setIsSigningIn(false);
      setIsRegistering(false);
      setIsRequestingRecovery(false);
      setIsResettingPassword(false);
      onClose?.();
    }
  };

  const handleSignInSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = signInEmail.trim();
    if (!email || !signInPassword) {
      setSignInError("Please enter your email and password.");
      return;
    }
    setSignInError("");
    setIsSigningIn(true);
    loginMutation.mutate({ email, password: signInPassword });
  };

  const handleRegisterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = regName.trim();
    const email = regEmail.trim();
    if (!name || !email || !regPassword) {
      setRegError("Please enter your name, email, and password.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRegError("Please enter a valid email address.");
      return;
    }
    if (regPassword.length < 8) {
      setRegError(passwordPolicyMessage());
      return;
    }
    setRegError("");
    setIsRegistering(true);
    registerMutation.mutate({ name, email, password: regPassword });
  };

  const handleForgotSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = recoveryEmail.trim();
    if (!email) {
      setRecoveryError("Please enter the email address for your Ledgerly account.");
      return;
    }
    setRecoveryError("");
    setRecoveryMessage("");
    setIsRequestingRecovery(true);
    forgotPasswordMutation.mutate({ email });
  };

  const handleResetSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = recoveryToken.trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setResetError("Enter the 64-character recovery token from your email.");
      return;
    }
    if (resetPassword.length < 8) {
      setResetError(passwordPolicyMessage());
      return;
    }
    setResetError("");
    setIsResettingPassword(true);
    resetPasswordMutation.mutate({ token, password: resetPassword });
  };

  const dialogOpen = onOpenChange ? open : internalOpen;
  const dialogTitle = title || {
    signin: "Sign in to Ledgerly",
    register: "Create your Ledgerly account",
    forgot: "Recover your Ledgerly account",
    reset: "Set a new Ledgerly password",
  }[mode];

  const dialogDescription = {
    signin: "Enter your email and password to access your secure Ledgerly workspace.",
    register: "Create a local Ledgerly account with a strong password.",
    forgot: "Enter your account email and we will send a one-time password-reset link.",
    reset: "Choose a new password using the one-time link sent to your email.",
  }[mode];

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(92vh,760px)] overflow-y-auto bg-card/95 px-6 py-6 text-center text-card-foreground sm:px-8 rounded-2xl w-full max-w-md shadow-2xl border border-border backdrop-blur-xl gap-4">
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-600 via-indigo-500 to-cyan-500 shadow-[0_8px_20px_rgba(99,102,241,0.25)] text-white">
            {logo ? <img src={logo} alt="Ledgerly" className="h-9 w-9 rounded-md object-contain" /> : <ShieldCheck className="h-7 w-7 text-white" aria-hidden="true" />}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/60 dark:text-indigo-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Secure Session Protected
          </div>
          <DialogTitle className={title ? "text-xl font-bold tracking-tight text-foreground" : "sr-only"}>
            {dialogTitle}
          </DialogTitle>
          <DialogDescription className="px-2 text-sm leading-relaxed text-muted-foreground">
            {dialogDescription}
          </DialogDescription>
        </div>

        {mode === "signin" ? (
          <form noValidate onSubmit={handleSignInSubmit} className="flex w-full flex-col gap-3.5 py-1 text-left">
            {signInError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">{signInError}</p> : null}
            <div className="space-y-1.5">
              <Label htmlFor="signInEmail" className="text-xs font-medium text-foreground">Email address</Label>
              <Input id="signInEmail" type="email" value={signInEmail} onChange={(event) => setSignInEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" className="h-10 bg-background/80 border-border text-sm text-foreground focus-visible:ring-indigo-500" />
            </div>
            <PasswordField id="signInPassword" label="Password" value={signInPassword} onChange={setSignInPassword} placeholder="Your password" autoComplete="current-password" visible={showSignInPassword} onToggle={() => setShowSignInPassword((value) => !value)} />
            <Button type="submit" disabled={isSigningIn} className="mt-2 h-11 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:shadow-lg disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white">{isSigningIn ? "Signing in..." : "Sign in"}</Button>
            <div className="flex flex-col items-center gap-1.5 border-t border-border pt-3 text-center">
              <button type="button" onClick={() => { setMode("forgot"); setRecoveryError(""); setRecoveryMessage(""); setGeneratedToken(null); }} className="rounded py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-indigo-600 hover:underline dark:hover:text-indigo-400">Forgot your password?</button>
              <button type="button" onClick={() => { setMode("register"); setRegError(""); }} className="rounded py-1 text-sm font-semibold text-indigo-600 underline-offset-4 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300">New to Ledgerly? Create an account</button>
            </div>
          </form>
        ) : null}

        {mode === "register" ? (
          <form noValidate onSubmit={handleRegisterSubmit} className="flex w-full flex-col gap-3.5 py-1 text-left">
            {regError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">{regError}</p> : null}
            <div className="space-y-1.5"><Label htmlFor="regName" className="text-xs font-medium text-foreground">Full name</Label><Input id="regName" value={regName} onChange={(event) => setRegName(event.target.value)} placeholder="Your name" autoComplete="name" className="h-10 bg-background/80 border-border text-sm text-foreground focus-visible:ring-indigo-500" /></div>
            <div className="space-y-1.5"><Label htmlFor="regEmail" className="text-xs font-medium text-foreground">Email address</Label><Input id="regEmail" type="email" value={regEmail} onChange={(event) => setRegEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" className="h-10 bg-background/80 border-border text-sm text-foreground focus-visible:ring-indigo-500" /></div>
            <div className="space-y-1.5"><PasswordField id="regPassword" label="Password" value={regPassword} onChange={setRegPassword} placeholder="At least 8 characters" autoComplete="new-password" visible={showRegPassword} onToggle={() => setShowRegPassword((value) => !value)} /><PasswordStrengthMeter password={regPassword} purpose="registration" /></div>
            <Button type="submit" disabled={isRegistering} className="mt-2 h-11 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:shadow-lg disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white">{isRegistering ? "Creating account..." : "Create account"}</Button>
            <button type="button" onClick={() => { setMode("signin"); setSignInError(""); }} className="rounded py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Already have an account? Sign in</button>
          </form>
        ) : null}

        {mode === "forgot" ? (
          <form noValidate onSubmit={handleForgotSubmit} className="flex w-full flex-col gap-3 py-1 text-left">
            {recoveryError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">{recoveryError}</p> : null}
            {recoveryMessage ? <p role="status" className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-3 text-xs leading-relaxed text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/60 dark:text-indigo-300">{recoveryMessage}</p> : null}
            
            {generatedToken ? (
              <div className="flex flex-col gap-2 rounded-xl border border-indigo-300 bg-gradient-to-br from-indigo-50 to-cyan-50/50 p-3.5 text-left shadow-sm dark:border-indigo-800 dark:from-indigo-950/60 dark:to-cyan-950/30">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                  <KeyRound className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Instant Recovery Ready!</span>
                </div>
                <p className="text-xs text-indigo-800/90 dark:text-indigo-300/90 leading-relaxed">
                  A secure 30-minute recovery token was generated. Click below to set a new password immediately:
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setRecoveryToken(generatedToken);
                    setResetError("");
                    setMode("reset");
                  }}
                  className="mt-1 h-9 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  ⚡ Set New Password Now (1-Click)
                </Button>
              </div>
            ) : null}

            <div className="space-y-1.5"><Label htmlFor="recoveryEmail" className="text-xs font-medium text-foreground">Account email</Label><Input id="recoveryEmail" type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" className="h-10 bg-background/80 border-border text-sm text-foreground focus-visible:ring-indigo-500" /></div>
            <Button type="submit" disabled={isRequestingRecovery} className="h-11 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white shadow-md transition-all disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white">{isRequestingRecovery ? "Sending..." : "Create Recovery Token / Send Link"}</Button>
            <Button type="button" variant="outline" onClick={() => { setMode("reset"); setResetError(""); }} className="h-10 w-full rounded-xl border-border text-sm hover:bg-accent hover:text-accent-foreground">I have a recovery token</Button>
            <button type="button" onClick={() => { setMode("signin"); setSignInError(""); }} className="rounded py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Back to sign in</button>
          </form>
        ) : null}

        {mode === "reset" ? (
          <form noValidate onSubmit={handleResetSubmit} className="flex w-full flex-col gap-3 py-1 text-left">
            {resetError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">{resetError}</p> : null}
            <div className="space-y-1.5"><Label htmlFor="recoveryToken" className="text-xs font-medium text-foreground">Recovery token</Label><Input id="recoveryToken" value={recoveryToken} onChange={(event) => setRecoveryToken(event.target.value)} placeholder="64-character token" autoComplete="one-time-code" className="h-10 bg-background/80 border-border font-mono text-xs text-foreground focus-visible:ring-indigo-500" /></div>
            <div className="space-y-1.5"><PasswordField id="resetPassword" label="New password" value={resetPassword} onChange={setResetPassword} placeholder="At least 8 characters" autoComplete="new-password" visible={showResetPassword} onToggle={() => setShowResetPassword((value) => !value)} /><PasswordStrengthMeter password={resetPassword} purpose="reset" /></div>
            <Button type="submit" disabled={isResettingPassword} className="mt-2 h-11 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white shadow-md transition-all disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white">{isResettingPassword ? "Updating password..." : "Set new password"}</Button>
            <button type="button" onClick={() => { setMode("forgot"); setRecoveryError(""); }} className="rounded py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Back to recovery help</button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
