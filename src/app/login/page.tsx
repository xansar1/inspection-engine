"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bike, Loader2, LockKeyhole, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getInspectionActor } from "@/lib/supabase/staff";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          throw new Error(`Existing session could not be verified: ${error.message}`);
        }
        if (!data.user) return;

        const actor = await getInspectionActor(supabase);
        if (actor) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        const { error: signOutError } = await supabase.auth.signOut();
        if (!cancelled) {
          setUnauthorized(true);
          if (signOutError) {
            setErrorMessage(
              `This account has no active workshop profile, and its session could not be cleared: ${signOutError.message}`
            );
          }
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Existing session could not be verified."
          );
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage("");
    setUnauthorized(false);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setErrorMessage(`Sign in failed: ${signInError.message}`);
        return;
      }

      const actor = await getInspectionActor(supabase);
      if (!actor) {
        const { error: signOutError } = await supabase.auth.signOut();
        setUnauthorized(true);
        setErrorMessage(
          signOutError
            ? `This account is not authorized, and its session could not be cleared: ${signOutError.message}`
            : "This account does not have an active workshop profile for an authorized role."
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      const { error: signOutError } = await supabase.auth.signOut();
      const detail =
        error instanceof Error
          ? error.message
          : "The workshop profile could not be verified.";
      setErrorMessage(
        signOutError
          ? `${detail} Sign out also failed: ${signOutError.message}`
          : `${detail} The session was cleared because authorization could not be verified.`
      );
      setUnauthorized(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5EF] px-4 py-10 text-[#26332A]">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-[#E8E3D8] bg-white shadow-[0_24px_70px_rgba(27,51,36,0.12)]">
        <div className="bg-[#183D2D] px-7 py-8 text-white sm:px-9">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E88B35] text-[#183D2D]">
              <Bike size={24} />
            </span>
            <span>
              <span className="block text-xs font-extrabold tracking-[1.4px]">
                INSPECTION ENGINE
              </span>
              <span className="mt-1 block text-[9px] font-semibold tracking-[2px] text-[#E99A4B]">
                TRUST IN EVERY DETAIL
              </span>
            </span>
          </Link>
          <h1 className="mt-8 text-2xl font-bold tracking-tight">
            Staff sign in
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Sign in with your workshop account to continue to your authorized workspace.
          </p>
        </div>

        <div className="p-7 sm:p-9">
          {checkingSession ? (
            <div className="flex items-center justify-center gap-3 py-8 text-sm text-[#697267]" role="status">
              <Loader2 size={18} className="animate-spin text-[#315D40]" />
              Checking your workshop session…
            </div>
          ) : (
            <>
              {unauthorized && (
                <div
                  role="status"
                  className="mb-5 flex items-start gap-3 rounded-xl border border-[#E9D1A8] bg-[#FFF6E9] p-3 text-xs leading-5 text-[#80643A]"
                >
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Access is limited to active admin, inspector, mechanic, or quality controller profiles.
                  </span>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-[#EBC4BA] bg-[#FCE9E5] p-3 text-xs leading-5 text-[#9F4A3A]"
                >
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-[#526052]">
                    Email address
                  </span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-[#E8E3D8] bg-[#FCFBF7] px-4 py-3 text-sm text-[#344337] outline-none transition focus:border-[#63866B] disabled:opacity-60"
                    placeholder="you@workshop.com"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-[#526052]">
                    Password
                  </span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-[#E8E3D8] bg-[#FCFBF7] px-4 py-3 text-sm text-[#344337] outline-none transition focus:border-[#63866B] disabled:opacity-60"
                    placeholder="Enter your password"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting || checkingSession}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E88B35] px-4 py-3 text-sm font-bold text-[#17291E] transition hover:bg-[#F3A451] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <LockKeyhole size={15} />
                  )}
                  {submitting ? "Verifying access…" : "Sign in securely"}
                </button>
              </form>

              <p className="mt-5 text-center text-[10px] leading-5 text-[#92958A]">
                Access requires an active staff profile. Contact your workshop administrator if your account is not authorized.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
