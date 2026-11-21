"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogOut, Loader2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getInspectionActor,
  type InspectionActor,
} from "@/lib/supabase/staff";

type AuthState = {
  status: "loading" | "signed_out" | "authorized" | "unauthorized" | "error";
  actor: InspectionActor | null;
  hasSession: boolean;
  message: string;
};

const initialState: AuthState = {
  status: "loading",
  actor: null,
  hasSession: false,
  message: "",
};

export default function AuthControls() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [authState, setAuthState] = useState(initialState);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          throw new Error(`Account status could not be checked: ${error.message}`);
        }
        if (!data.user) {
          if (!cancelled) {
            setAuthState({
              status: "signed_out",
              actor: null,
              hasSession: false,
              message: "",
            });
          }
          return;
        }

        const actor = await getInspectionActor(supabase);
        if (!cancelled) {
          setAuthState({
            status: actor ? "authorized" : "unauthorized",
            actor,
            hasSession: true,
            message: actor
              ? ""
              : "This account does not have an active workshop profile.",
          });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setAuthState({
            status: "error",
            actor: null,
            hasSession: true,
            message:
              error instanceof Error
                ? error.message
                : "Account status could not be checked.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setAuthState((current) => ({ ...current, message: "" }));
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }

      setAuthState({
        status: "signed_out",
        actor: null,
        hasSession: false,
        message: "",
      });
      router.replace("/login");
      router.refresh();
    } catch (error: unknown) {
      setAuthState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? `Sign out failed: ${error.message}`
            : "Sign out failed.",
      }));
    } finally {
      setSigningOut(false);
    }
  }

  if (authState.status === "loading") {
    return (
      <span className="inline-flex items-center gap-2 text-[10px] text-[#92958A]" role="status">
        <Loader2 size={13} className="animate-spin" /> Checking account
      </span>
    );
  }

  if (authState.status === "signed_out") {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-xl border border-[#E8E3D8] bg-white px-3 py-2 text-[11px] font-bold text-[#28543D] transition hover:bg-[#F2EFE6]"
      >
        <UserRound size={14} /> Staff sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="max-w-36 truncate text-[11px] font-bold text-[#344337]">
          {authState.actor?.profile.full_name ?? "Unverified account"}
        </p>
        <p
          className="text-[9px] capitalize text-[#92958A]"
          title={authState.message || undefined}
        >
          {authState.actor?.profile.role.replaceAll("_", " ") ??
            (authState.status === "error" ? "verification unavailable" : "unauthorized")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={signingOut}
        className="inline-flex items-center gap-2 rounded-xl border border-[#E8E3D8] bg-white px-3 py-2 text-[11px] font-bold text-[#526052] transition hover:bg-[#F2EFE6] disabled:opacity-60"
      >
        {signingOut ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <LogOut size={13} />
        )}
        <span className="hidden sm:inline">
          {signingOut ? "Signing out" : "Sign out"}
        </span>
      </button>
      {authState.message && (
        <span className="sr-only" role="alert">
          {authState.message}
        </span>
      )}
    </div>
  );
}
