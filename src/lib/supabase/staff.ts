import type { User } from "@supabase/supabase-js";
import type { createClient } from "./client";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export type InspectionActor = {
  user: User;
  profile: {
    id: string;
    full_name: string;
    role: "admin" | "inspector" | "mechanic" | "quality_controller";
  };
};

export function getWorkspacePath(
  role: InspectionActor["profile"]["role"]
) {
  return role === "admin" ? "/dashboard" : "/inspections";
}

export async function getInspectionActor(
  supabase: SupabaseBrowserClient
): Promise<InspectionActor | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw new Error(`Authentication check failed: ${authError.message}`);
  }
  if (!authData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Inspector profile could not be loaded: ${profileError.message}`);
  }
  if (
    !profile ||
    !profile.is_active ||
    (profile.role !== "admin" &&
      profile.role !== "inspector" &&
      profile.role !== "mechanic" &&
      profile.role !== "quality_controller")
  ) {
    return null;
  }

  return {
    user: authData.user,
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
    },
  };
}
