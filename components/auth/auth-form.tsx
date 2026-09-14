"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OprynLogo } from "@/components/opryn-logo";

type Mode = "login" | "signup" | "forgot" | "reset";

export function AuthForm({ mode }: { mode: Mode }) {
  const [supabase] = useState(createClient);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const requestedNext = searchParams.get("next") ?? "/app";
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/app";
  const signupNext = next === "/app" ? "/onboarding" : next;

  const copy = {
    login: ["Welcome back", "Sign in to your Opryn workspace."],
    signup: [
      "Create your account",
      "Start getting your business out of your head.",
    ],
    forgot: [
      "Reset your password",
      "We’ll send a secure reset link to your email.",
    ],
    reset: ["Choose a new password", "Use at least eight characters."],
  }[mode];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        router.replace(next);
        router.refresh();
      } else if (mode === "signup") {
        if (password.length < 8)
          throw new Error("Password must be at least 8 characters.");
        if (password !== confirmPassword)
          throw new Error("Passwords do not match.");
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(signupNext)}`,
          },
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace(signupNext);
          router.refresh();
        } else
          setMessage(
            "Check your email to confirm your account, then continue to onboarding.",
          );
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
          },
        );
        if (authError) throw authError;
        setMessage("Password reset link sent. Check your inbox.");
      } else {
        if (password.length < 8)
          throw new Error("Password must be at least 8 characters.");
        if (password !== confirmPassword)
          throw new Error("Passwords do not match.");
        const { error: authError } = await supabase.auth.updateUser({
          password,
        });
        if (authError) throw authError;
        router.replace("/app");
        router.refresh();
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  return (
    <main className="opryn-auth-page min-h-screen px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-[440px]">
        <Link
          href="/"
          className="opryn-auth-logo mb-8 flex items-center justify-center"
          aria-label="Opryn home"
        >
          <OprynLogo size="large" priority />
        </Link>
        <section
          className="opryn-auth-card rounded-[22px] border border-[#dfe5ed] bg-white p-6 shadow-[0_22px_60px_rgba(24,39,75,.08)] sm:p-8"
          aria-labelledby="auth-heading"
        >
          <h1
            id="auth-heading"
            className="text-[28px] font-semibold tracking-[-.04em]"
          >
            {copy[0]}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#69758a]">{copy[1]}</p>
          {message ? (
            <div className="mt-6 flex gap-2 rounded-xl bg-[#ecf8f3] p-3 text-sm text-[#176f56]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              {message}
            </div>
          ) : null}
          <form onSubmit={submit} className="opryn-auth-form mt-7 space-y-4">
            {mode === "signup" ? (
              <Field
                label="Full name"
                value={fullName}
                onChange={setFullName}
                autoComplete="name"
                required
              />
            ) : null}
            {mode !== "reset" ? (
              <Field
                label="Work email"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                required
              />
            ) : null}
            {mode === "login" || mode === "signup" || mode === "reset" ? (
              <Field
                label={mode === "reset" ? "New password" : "Password"}
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            ) : null}
            {mode === "signup" || mode === "reset" ? (
              <Field
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                type="password"
                autoComplete="new-password"
                required
              />
            ) : null}
            {mode === "login" ? (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-[#3158d8] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-[#fff0f1] px-3 py-2.5 text-sm text-[#a83f49]"
              >
                {error}
              </p>
            ) : null}
            <button
              disabled={loading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white shadow-[0_9px_22px_rgba(49,88,216,.2)] transition hover:bg-[#2446b8] disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              {mode === "login"
                ? "Sign In"
                : mode === "signup"
                  ? "Create Account"
                  : mode === "forgot"
                    ? "Send Reset Link"
                    : "Update Password"}
              {!loading ? <ArrowRight className="size-4" /> : null}
            </button>
          </form>
          {mode === "login" || mode === "signup" ? (
            <>
              <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[.12em] text-[#9aa3b0]">
                <span className="h-px flex-1 bg-[#e4e8ee]" />
                or
                <span className="h-px flex-1 bg-[#e4e8ee]" />
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={continueWithGoogle}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#d7dde6] bg-white px-4 text-sm font-semibold text-[#263246] transition hover:bg-[#f9fafc] disabled:opacity-60"
              >
                <GoogleMark />
                Continue with Google
              </button>
            </>
          ) : null}
          <p className="mt-7 text-center text-sm text-[#707c8e]">
            {mode === "login" ? (
              <>
                New to Opryn?{" "}
                <Link
                  href={`/signup${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}
                  className="font-semibold text-[#3158d8]"
                >
                  Create an account
                </Link>
              </>
            ) : null}
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <Link
                  href={`/login${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}
                  className="font-semibold text-[#3158d8]"
                >
                  Sign in
                </Link>
              </>
            ) : null}
            {mode === "forgot" ? (
              <Link href="/login" className="font-semibold text-[#3158d8]">
                Back to sign in
              </Link>
            ) : null}
          </p>
        </section>
        <div className="opryn-auth-loop" aria-label="The Opryn learning loop">
          <span>Teach it once</span>
          <i aria-hidden="true" />
          <strong>Get the answer next time</strong>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="opryn-auth-field block text-sm font-medium text-[#354157]">
      {label}
      <input
        className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5 outline-none transition focus:border-[#7190ee] focus:ring-4 focus:ring-[#3158d8]/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        required={required}
      />
    </label>
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
