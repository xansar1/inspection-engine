"use client";

import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
} from "@/app/_components/DemoModuleShell";

type DemoRole = "Inspector" | "Mechanic" | "Quality Controller";

const demoTeam = [
  { id: "STAFF-DEMO-01", name: "Aarav Menon", role: "Mechanic" as const, shift: "Morning · 08:00–16:00", workload: 4, status: "Available" },
  { id: "STAFF-DEMO-02", name: "Meera Nair", role: "Inspector" as const, shift: "Morning · 08:00–16:00", workload: 3, status: "On inspection" },
  { id: "STAFF-DEMO-03", name: "Kabir Shah", role: "Quality Controller" as const, shift: "Day · 09:00–17:00", workload: 2, status: "Available" },
  { id: "STAFF-DEMO-04", name: "Ishita Rao", role: "Mechanic" as const, shift: "Day · 09:00–17:00", workload: 5, status: "On repair" },
  { id: "STAFF-DEMO-05", name: "Rohan Iyer", role: "Inspector" as const, shift: "Afternoon · 12:00–20:00", workload: 1, status: "Available" },
  { id: "STAFF-DEMO-06", name: "Sana Kulkarni", role: "Quality Controller" as const, shift: "Afternoon · 12:00–20:00", workload: 2, status: "On review" },
];

const roleFilters: Array<"All" | DemoRole> = [
  "All",
  "Inspector",
  "Mechanic",
  "Quality Controller",
];

export default function TeamPage() {
  const [roleFilter, setRoleFilter] = useState<"All" | DemoRole>("All");
  const filteredTeam = useMemo(
    () =>
      demoTeam.filter(
        (member) => roleFilter === "All" || member.role === roleFilter
      ),
    [roleFilter]
  );
  const inspectors = demoTeam.filter((member) => member.role === "Inspector").length;
  const mechanics = demoTeam.filter((member) => member.role === "Mechanic").length;
  const qualityControllers = demoTeam.filter(
    (member) => member.role === "Quality Controller"
  ).length;

  return (
    <DemoModulePage
      title="Team Members"
      description="Browse a sample workshop roster by role, shift and illustrative workload."
      icon={Users}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard label="Demo team" value={demoTeam.length} detail="Illustrative staff roster" icon={Users} />
        <DemoMetricCard label="Inspectors" value={inspectors} detail="Demo team members" icon={ClipboardCheck} accent="orange" />
        <DemoMetricCard label="Mechanics" value={mechanics} detail="Demo team members" icon={Wrench} />
        <DemoMetricCard label="Quality controllers" value={qualityControllers} detail="Demo team members" icon={ShieldCheck} accent="amber" />
      </section>

      <DemoPanel
        title="Workshop roster"
        description="All names, shifts and workload counts are fictional demo information."
      >
        <div className="mb-5 flex flex-wrap gap-2">
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTeam.map((member) => {
            const roleIcon =
              member.role === "Inspector"
                ? ClipboardCheck
                : member.role === "Mechanic"
                  ? Wrench
                  : ShieldCheck;
            const RoleIcon = roleIcon;
            return (
              <article
                key={member.id}
                className="rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F2E5] text-sm font-bold text-[#28543D]">
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-[#344337]">
                      {member.name}
                    </h3>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#697267]">
                      <RoleIcon size={13} className="text-[#A27649]" />
                      {member.role}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3 border-t border-[#EEECE5] pt-4">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#92958A]">Shift</span>
                    <span className="text-right font-semibold text-[#475448]">
                      {member.shift}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#92958A]">Assigned demo jobs</span>
                    <span className="font-bold text-[#475448]">{member.workload}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#92958A]">Sample status</span>
                    <span className="rounded-full bg-[#EDF3EB] px-2.5 py-1 font-bold text-[#315D40]">
                      {member.status}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </DemoPanel>
    </DemoModulePage>
  );
}
