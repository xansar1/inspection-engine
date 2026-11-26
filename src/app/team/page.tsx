"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  ShieldCheck,
  Users,
  Wrench,
  RefreshCw,
  AlertCircle,
  UserRound,
} from "lucide-react";

import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
} from "@/app/_components/DemoModuleShell";

import { createClient } from "@/lib/supabase/client";
import { getInspectionActor } from "@/lib/supabase/staff";

type StaffRole =
  | "admin"
  | "inspector"
  | "mechanic"
  | "quality_controller";

type RoleFilter =
  | "All"
  | "Admin"
  | "Inspector"
  | "Mechanic"
  | "Quality Controller";

type TeamMember = {
  id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  workload: number | null;
};

const roleFilters: RoleFilter[] = [
  "All",
  "Admin",
  "Inspector",
  "Mechanic",
  "Quality Controller",
];

const roleLabels: Record<StaffRole, string> = {
  admin: "Admin",
  inspector: "Inspector",
  mechanic: "Mechanic",
  quality_controller: "Quality Controller",
};

function getRoleIcon(role: StaffRole) {
  switch (role) {
    case "admin":
      return ShieldCheck;
    case "inspector":
      return ClipboardCheck;
    case "mechanic":
      return Wrench;
    case "quality_controller":
      return ShieldCheck;
  }
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getWorkloadLabel(role: StaffRole) {
  switch (role) {
    case "admin":
      return "Admin account";
    case "inspector":
      return "Active inspections";
    case "mechanic":
      return "Open assigned repairs";
    case "quality_controller":
      return "Reviews recorded";
  }
}

export default function TeamPage() {
  const supabase = useMemo(() => createClient(), []);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const actor = await getInspectionActor(supabase);

      if (!actor) {
        throw new Error("Your staff account could not be verified.");
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .order("full_name", { ascending: true });

      if (profilesError) {
        throw new Error(
          `Unable to load team members: ${profilesError.message}`
        );
      }

      const validProfiles = (profiles ?? []).filter(
        (profile) =>
          ["admin", "inspector", "mechanic", "quality_controller"].includes(
            profile.role
          )
      );

      if (validProfiles.length === 0) {
        setTeam([]);
        return;
      }

      const staffIds = validProfiles.map((profile) => profile.id);

      const [
        inspectionsResult,
        repairsResult,
        reviewsResult,
      ] = await Promise.all([
        supabase
          .from("inspections")
          .select("inspector_id, status")
          .in("inspector_id", staffIds),

        supabase
          .from("repair_jobs")
          .select("assigned_mechanic_id, status")
          .in("assigned_mechanic_id", staffIds),

        actor.profile.role === "admin" ||
        actor.profile.role === "quality_controller"
          ? supabase
              .from("quality_reviews")
              .select("reviewer_id")
              .in("reviewer_id", staffIds)
          : Promise.resolve({
              data: null,
              error: null,
            }),
      ]);

      if (inspectionsResult.error) {
        throw new Error(
          `Unable to load inspection workload: ${inspectionsResult.error.message}`
        );
      }

      if (repairsResult.error) {
        throw new Error(
          `Unable to load repair workload: ${repairsResult.error.message}`
        );
      }

      if (reviewsResult.error) {
        throw new Error(
          `Unable to load quality review workload: ${reviewsResult.error.message}`
        );
      }

      const activeInspectionStatuses = [
        "draft",
        "in_progress",
        "submitted",
        "qc_pending",
        "repair_required",
      ];

      const openRepairStatuses = [
        "pending",
        "assigned",
        "in_progress",
      ];

      const nextTeam: TeamMember[] = validProfiles.map((profile) => {
        const role = profile.role as StaffRole;

        let workload: number | null = 0;

        if (role === "inspector") {
          workload = (inspectionsResult.data ?? []).filter(
            (inspection) =>
              inspection.inspector_id === profile.id &&
              activeInspectionStatuses.includes(inspection.status)
          ).length;
        } else if (role === "mechanic") {
          workload = (repairsResult.data ?? []).filter(
            (repair) =>
              repair.assigned_mechanic_id === profile.id &&
              openRepairStatuses.includes(repair.status)
          ).length;
        } else if (role === "quality_controller") {
          workload = reviewsResult.data
            ? reviewsResult.data.filter(
                (review) => review.reviewer_id === profile.id
              ).length
            : null;
        }

        return {
          id: profile.id,
          name: profile.full_name || "Unnamed staff member",
          role,
          isActive: Boolean(profile.is_active),
          workload,
        };
      });

      setTeam(nextTeam);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load team members."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const filteredTeam = useMemo(() => {
    return team.filter((member) => {
      if (roleFilter === "All") return true;

      const selectedRole = roleFilter.toLowerCase().replaceAll(" ", "_");
      return member.role === selectedRole;
    });
  }, [team, roleFilter]);

  const activeCount = team.filter((member) => member.isActive).length;
  const inspectors = team.filter(
    (member) => member.role === "inspector"
  ).length;
  const mechanics = team.filter(
    (member) => member.role === "mechanic"
  ).length;
  const qualityControllers = team.filter(
    (member) => member.role === "quality_controller"
  ).length;

  return (
    <DemoModulePage
      title="Team Members"
      description="Manage your workshop team and view staff roles, account status and workload."
      icon={Users}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard
          label="Total team"
          value={team.length}
          detail={`${activeCount} active staff accounts`}
          icon={Users}
        />

        <DemoMetricCard
          label="Inspectors"
          value={inspectors}
          detail="Registered inspector accounts"
          icon={ClipboardCheck}
          accent="orange"
        />

        <DemoMetricCard
          label="Mechanics"
          value={mechanics}
          detail="Registered mechanic accounts"
          icon={Wrench}
        />

        <DemoMetricCard
          label="Quality controllers"
          value={qualityControllers}
          detail="Registered QC accounts"
          icon={ShieldCheck}
          accent="amber"
        />
      </section>

      <DemoPanel
        title="Workshop roster"
        description="Live staff accounts and workload information from your workshop database."
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {roleFilters.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                aria-pressed={roleFilter === role}
                className={`rounded-full px-3.5 py-2 text-[11px] font-bold transition ${
                  roleFilter === role
                    ? "bg-[#244A36] text-white"
                    : "border border-[#E8E3D8] bg-[#FAF9F5] text-[#697267] hover:text-[#244A36]"
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadTeam()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-[#E8E3D8] bg-white px-3.5 py-2 text-[11px] font-bold text-[#475448] transition hover:border-[#244A36] disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Unable to load team data</p>
              <p className="mt-1 text-xs">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-xl border border-[#EEECE5] bg-[#FCFBF7]"
              />
            ))}
          </div>
        ) : filteredTeam.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8E3D8] bg-[#FCFBF7] px-5 py-12 text-center">
            <UserRound size={30} className="text-[#A3AA9F]" />
            <h3 className="mt-3 text-sm font-bold text-[#344337]">
              No team members found
            </h3>
            <p className="mt-1 text-xs text-[#92958A]">
              {team.length === 0
                ? "No staff profiles are available in the database."
                : "There are no staff members under this role."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTeam.map((member) => {
              const RoleIcon = getRoleIcon(member.role);

              return (
                <article
                  key={member.id}
                  className="rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F2E5] text-sm font-bold text-[#28543D]">
                      {getInitials(member.name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-[#344337]">
                        {member.name}
                      </h3>

                      <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#697267]">
                        <RoleIcon size={13} className="text-[#A27649]" />
                        {roleLabels[member.role]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-[#EEECE5] pt-4">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#92958A]">Account status</span>

                      <span
                        className={`rounded-full px-2.5 py-1 font-bold ${
                          member.isActive
                            ? "bg-[#EDF3EB] text-[#315D40]"
                            : "bg-[#FBECE8] text-[#A34D3C]"
                        }`}
                      >
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#92958A]">
                        {getWorkloadLabel(member.role)}
                      </span>

                      <span className="font-bold text-[#475448]">
                        {member.workload === null
                          ? "Not available"
                          : member.workload}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#92958A]">Staff ID</span>
                      <span className="max-w-[150px] truncate font-semibold text-[#475448]">
                        {member.id}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </DemoPanel>
    </DemoModulePage>
  );
}