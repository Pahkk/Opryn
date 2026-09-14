"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { LogOut, X } from "lucide-react";

type AuthContextValue = {
  loading: boolean;
  openAuth: () => void;
  signOut: () => Promise<void>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [open, setOpen] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function continueWithGoogle() {
    setAuthenticating(true);
    setError("");
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (signInError) {
      setError(signInError.message);
      setAuthenticating(false);
    }
  }

  async function signOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ loading: false, openAuth: () => setOpen(true), signOut, user }}
    >
      {children}
      {open ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-[#0d1729]/55 p-4 backdrop-blur-[8px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setOpen(false)
          }
        >
          <div className="w-full max-w-[440px] rounded-[22px] border border-white/20 bg-white p-6 shadow-[0_35px_90px_rgba(8,15,30,.3)] sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.13em] text-[#3158d8]">
                  Welcome to Opryn
                </p>
                <h2
                  id="auth-title"
                  className="mt-2 text-[28px] font-semibold tracking-[-.04em]"
                >
                  Sign in or create an account
                </h2>
              </div>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-full text-[#667184] hover:bg-[#f2f4f7]"
                onClick={() => setOpen(false)}
                aria-label="Close sign in"
              >
                <X size={19} />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#687487]">
              Use your Google account to save your progress and access Opryn
              securely.
            </p>
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={authenticating}
              className="mt-7 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#d7dde6] bg-white px-4 text-sm font-semibold text-[#263246] shadow-sm transition hover:border-[#b9c3d1] hover:bg-[#f9fafc] disabled:cursor-wait disabled:opacity-65"
            >
              <GoogleMark />
              {authenticating
                ? "Connecting to Google…"
                : "Continue with Google"}
            </button>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white hover:bg-[#2446b8]"
            >
              Continue with email
            </Link>
            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-[#fff0f1] px-3 py-2 text-center text-xs font-medium text-[#a83f49]"
              >
                {error}
              </p>
            ) : null}
            <p className="mt-5 text-center text-[10px] leading-5 text-[#929ba8]">
              By continuing, you agree to Opryn&apos;s{" "}
              <a
                href="/terms"
                className="underline decoration-[#c2c9d3] underline-offset-2 hover:text-[#596577]"
              >
                Terms
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                className="underline decoration-[#c2c9d3] underline-offset-2 hover:text-[#596577]"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export function AccountControls({ mobile = false }: { mobile?: boolean }) {
  const { loading, openAuth, signOut, user } = useAuth();

  if (loading) return <div className="h-10 w-20" aria-hidden="true" />;
  if (!user)
    return (
      <button
        className={
          mobile
            ? "py-3.5 text-left text-sm font-medium"
            : "button button-ghost"
        }
        type="button"
        onClick={openAuth}
      >
        Sign In
      </button>
    );

  const label = user.user_metadata.full_name ?? user.email ?? "Account";
  const initial = label.slice(0, 1).toUpperCase();
  return (
    <div
      className={`flex items-center ${mobile ? "justify-between py-3" : "gap-2"}`}
    >
      <Link
        href="/app"
        className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#39465a]"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#edf2ff] text-xs font-bold text-[#3158d8]">
          {initial}
        </span>
        <span className="max-w-32 truncate">{label}</span>
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="grid size-9 place-items-center rounded-lg text-[#6d7888] hover:bg-[#f0f3f7]"
        aria-label="Sign out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.25-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}
