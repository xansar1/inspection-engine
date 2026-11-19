"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, IndianRupee, Wrench } from "lucide-react";
import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
  demoButtonClass,
} from "@/app/_components/DemoModuleShell";

type RepairStatus = "Pending" | "In progress" | "Completed";
type DemoRepair = {
  id: string;
  vehicle: string;
  registration: string;
  work: string;
  mechanic: string;
  status: RepairStatus;
  estimatedCost: number;
};

const initialRepairs: DemoRepair[] = [
  {
    id: "JOB-DEMO-1042",
    vehicle: "Honda Activa 6G",
    registration: "KA 03 MN 4821",
    work: "Replace rear brake shoes",
    mechanic: "Aarav Menon",
    status: "Pending",
    estimatedCost: 2450,
  },
  {
    id: "JOB-DEMO-1041",
    vehicle: "Bajaj Pulsar N160",
    registration: "MH 12 QX 6314",
    work: "Chain and sprocket service",
    mechanic: "Meera Nair",
    status: "In progress",
    estimatedCost: 3800,
  },
  {
    id: "JOB-DEMO-1038",
    vehicle: "TVS Jupiter 125",
    registration: "TN 09 CF 2758",
    work: "Battery replacement",
    mechanic: "Kabir Shah",
    status: "Completed",
    estimatedCost: 2100,
  },
  {
    id: "JOB-DEMO-1036",
    vehicle: "Royal Enfield Hunter 350",
    registration: "KA 05 PV 7316",
    work: "Front fork seal inspection",
    mechanic: "Aarav Menon",
    status: "Pending",
    estimatedCost: 5200,
  },
];

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function RepairsPage() {
  const [repairs, setRepairs] = useState(initialRepairs);
  const [statusFilter, setStatusFilter] = useState("All");
  const filteredRepairs = useMemo(
    () =>
      repairs.filter(
        (repair) =>
          statusFilter === "All" || repair.status === statusFilter
      ),
    [repairs, statusFilter]
  );
  const pendingCount = repairs.filter((repair) => repair.status === "Pending").length;
  const inProgressCount = repairs.filter((repair) => repair.status === "In progress").length;
  const completedCount = repairs.filter((repair) => repair.status === "Completed").length;
  const estimatedTotal = repairs
    .filter((repair) => repair.status !== "Completed")
    .reduce((total, repair) => total + repair.estimatedCost, 0);

  function advanceRepair(id: string) {
    setRepairs((current) =>
      current.map((repair) => {
        if (repair.id !== id) return repair;
        return {
          ...repair,
          status: repair.status === "Pending" ? "In progress" : "Completed",
        };
      })
    );
  }

  return (
    <DemoModulePage
      title="Repair Management"
      description="Coordinate repair jobs, assigned mechanics, progress and estimated costs in this demo workspace."
      icon={Wrench}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard label="Pending repairs" value={pendingCount} detail="Demo jobs awaiting work" icon={Clock3} accent="amber" />
        <DemoMetricCard label="In progress" value={inProgressCount} detail="Currently assigned demo jobs" icon={Wrench} accent="orange" />
        <DemoMetricCard label="Completed repairs" value={completedCount} detail="Completed sample jobs" icon={CheckCircle2} />
        <DemoMetricCard label="Estimated open cost" value={currency.format(estimatedTotal)} detail="Illustrative estimate only" icon={IndianRupee} accent="orange" />
      </section>

      <DemoPanel
        title="Repair jobs"
        description="Advance a sample job to preview the repair workflow. Changes remain in this page session."
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#92958A]">
            {filteredRepairs.length} demo jobs
          </p>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#697267]">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-2 text-xs text-[#344337] outline-none focus:border-[#63866B]"
            >
              <option>All</option>
              <option>Pending</option>
              <option>In progress</option>
              <option>Completed</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredRepairs.map((repair) => {
            const statusClass =
              repair.status === "Completed"
                ? "bg-[#E7F4E6] text-[#26804B]"
                : repair.status === "In progress"
                  ? "bg-[#FFF0E0] text-[#B66A2B]"
                  : "bg-[#FFF3E4] text-[#9A7026]";

            return (
              <article
                key={repair.id}
                className="rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-wide text-[#A27649]">
                      {repair.id}
                    </p>
                    <h3 className="mt-1 text-sm font-bold text-[#344337]">
                      {repair.vehicle}
                    </h3>
                    <p className="mt-1 text-[10px] text-[#92958A]">
                      {repair.registration}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>
                    {repair.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 border-t border-[#EEECE5] pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                      Repair work
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#475448]">
                      {repair.work}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                      Assigned mechanic
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#475448]">
                      {repair.mechanic}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                      Estimated cost
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#344337]">
                      {currency.format(repair.estimatedCost)}
                    </p>
                  </div>
                </div>

                {repair.status !== "Completed" && (
                  <button
                    type="button"
                    onClick={() => advanceRepair(repair.id)}
                    className={`${demoButtonClass} mt-4`}
                  >
                    {repair.status === "Pending" ? "Start repair" : "Mark complete"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </DemoPanel>
    </DemoModulePage>
  );
}
