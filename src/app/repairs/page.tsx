
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  IndianRupee,
  Wrench,
  RefreshCw,
  History,
  UserRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { getInspectionActor } from "@/lib/supabase/staff";

import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
  demoButtonClass,
  demoSubtleButtonClass,
} from "@/app/_components/DemoModuleShell";

type RepairStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "verified"
  | "cancelled";

type RepairJob = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: RepairStatus;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  completed_at: string | null;

  inspection: {
    id: string;
    status: string;
    vehicle: {
      registration_number: string;
      make: string;
      model: string;
      variant: string | null;
    } | null;
  } | null;

  mechanic: {
    id: string;
    full_name: string;
  } | null;
};

type Mechanic = {
  id: string;
  full_name: string;
};

type RepairUpdate = {
  id: string;
  status: string | null;
  note: string | null;
  created_at: string;
  updated_by: string | null;
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const statusLabels: Record<RepairStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  verified: "Verified",
  cancelled: "Cancelled",
};

const statusStyles: Record<RepairStatus, string> = {
  pending: "bg-[#FFF3E4] text-[#9A7026]",
  assigned: "bg-[#E8EFFD] text-[#4265A5]",
  in_progress: "bg-[#FFF0E0] text-[#B66A2B]",
  completed: "bg-[#E7F4E6] text-[#26804B]",
  verified: "bg-[#DDF3E8] text-[#16734B]",
  cancelled: "bg-[#F1EEEE] text-[#777777]",
};

export default function RepairsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [repairs, setRepairs] = useState<RepairJob[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);

  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [historyJobId, setHistoryJobId] = useState("");
  const [history, setHistory] = useState<RepairUpdate[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load authenticated user, repair jobs and mechanics.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const actor = await getInspectionActor(supabase);

      if (!actor) {
        throw new Error(
          "Your active staff profile could not be found. Please sign in again."
        );
      }

      setRole(actor.profile.role);
      setUserId(actor.user.id);

      const { data, error: jobsError } = await supabase
        .from("repair_jobs")
        .select(`
          id,
          title,
          description,
          priority,
          status,
          estimated_cost,
          actual_cost,
          created_at,
          completed_at,
          inspection:inspections!repair_jobs_inspection_id_fkey (
            id,
            status,
            vehicle:vehicles!inspections_vehicle_id_fkey (
              registration_number,
              make,
              model,
              variant
            )
          ),
          mechanic:profiles!repair_jobs_assigned_mechanic_id_fkey (
            id,
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;

      setRepairs((data ?? []) as unknown as RepairJob[]);

      // Only admins need the mechanic assignment list.
      if (actor.profile.role === "admin") {
        const { data: mechanicData, error: mechanicError } =
          await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("role", "mechanic")
            .eq("is_active", true)
            .order("full_name");

        if (mechanicError) throw mechanicError;

        setMechanics((mechanicData ?? []) as Mechanic[]);
      } else {
        setMechanics([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load repair jobs."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Execute existing secure Supabase RPC functions.
  async function runAction(
    jobId: string,
    action: string,
    args: Record<string, unknown>
  ) {
    setBusyId(jobId);
    setError("");
    setMessage("");

    try {
      const { error: actionError } = await supabase.rpc(
        action as never,
        args as never
      );

      if (actionError) throw actionError;

      setMessage("Repair job updated successfully.");

      setNotes((current) => ({
        ...current,
        [jobId]: "",
      }));

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The repair action failed."
      );
    } finally {
      setBusyId("");
    }
  }

  // Read repair history.
  async function showHistory(jobId: string) {
    if (historyJobId === jobId) {
      setHistoryJobId("");
      setHistory([]);
      return;
    }

    setHistoryJobId(jobId);
    setHistory([]);
    setHistoryLoading(true);
    setError("");

    try {
      const { data, error: historyError } = await supabase
        .from("repair_updates")
        .select("id, status, note, created_at, updated_by")
        .eq("repair_job_id", jobId)
        .order("created_at", { ascending: false });

      if (historyError) throw historyError;

      setHistory((data ?? []) as RepairUpdate[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load repair history."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  // Dashboard metrics.
  const pendingCount = repairs.filter(
    (job) => job.status === "pending"
  ).length;

  const assignedCount = repairs.filter(
    (job) => job.status === "assigned"
  ).length;

  const inProgressCount = repairs.filter(
    (job) => job.status === "in_progress"
  ).length;

  const activeCount = assignedCount + inProgressCount;

  const completedCount = repairs.filter(
    (job) => job.status === "completed"
  ).length;

  const verifiedCount = repairs.filter(
    (job) => job.status === "verified"
  ).length;

  const estimatedTotal = repairs
    .filter(
      (job) =>
        job.status !== "verified" &&
        job.status !== "cancelled"
    )
    .reduce(
      (sum, job) => sum + Number(job.estimated_cost ?? 0),
      0
    );

  const filteredRepairs = repairs.filter(
    (job) =>
      statusFilter === "all" ||
      job.status === statusFilter
  );

  return (
    <DemoModulePage
      title="Repair Management"
      description="Coordinate repair jobs, assigned mechanics, progress and estimated costs."
      icon={Wrench}
      modeLabel="LIVE DATA"
      notice="Live workshop records connected securely through Supabase."
    >
      {/* Error and success messages */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* Metrics */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard
          label="Pending repairs"
          value={pendingCount}
          detail="Awaiting mechanic assignment"
          icon={Clock3}
          accent="amber"
        />

        <DemoMetricCard
          label="Active repairs"
          value={activeCount}
          detail={`${assignedCount} assigned · ${inProgressCount} in progress`}
          icon={Wrench}
          accent="orange"
        />

        <DemoMetricCard
          label="Completed repairs"
          value={completedCount + verifiedCount}
          detail={`${completedCount} awaiting QC · ${verifiedCount} verified`}
          icon={CheckCircle2}
          accent="green"
        />

        <DemoMetricCard
          label="Estimated open cost"
          value={currency.format(estimatedTotal)}
          detail="Based on open repair jobs"
          icon={IndianRupee}
          accent="orange"
        />
      </section>

      {/* Repair jobs panel */}

      <DemoPanel
        title="Repair jobs"
        description="Live repair jobs, mechanic assignments and quality verification."
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#92958A]">
            {loading
              ? "Loading repair jobs..."
              : `${filteredRepairs.length} repair jobs`}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#697267]">
              Status

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="rounded-lg border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-2 text-xs text-[#344337] outline-none focus:border-[#63866B]"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="verified">Verified</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className={demoSubtleButtonClass}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading */}

        {loading ? (
          <div className="py-12 text-center text-sm text-[#92958A]">
            Loading live repair records...
          </div>
        ) : filteredRepairs.length === 0 ? (
          /* Empty state */

          <div className="rounded-xl border border-dashed border-[#DDD8CC] bg-[#FCFBF7] px-4 py-12 text-center">
            <Wrench
              size={32}
              className="mx-auto text-[#A27649]"
            />

            <h3 className="mt-3 text-sm font-bold text-[#344337]">
              No repair jobs found
            </h3>

            <p className="mt-1 text-xs text-[#92958A]">
              Real repair jobs will appear here when inspections create them.
            </p>
          </div>
        ) : (
          /* Repair cards */

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredRepairs.map((job) => {
              const vehicle = job.inspection?.vehicle;
              const isBusy = busyId === job.id;

              const mechanicId =
                assignments[job.id] ??
                job.mechanic?.id ??
                "";

              return (
                <article
                  key={job.id}
                  className="rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4"
                >
                  {/* Job header */}

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold tracking-wide text-[#A27649]">
                        JOB-{job.id.slice(0, 8).toUpperCase()}
                      </p>

                      <h3 className="mt-1 text-sm font-bold text-[#344337]">
                        {vehicle
                          ? `${vehicle.make} ${vehicle.model}`
                          : "Vehicle details unavailable"}
                      </h3>

                      <p className="mt-1 text-[10px] text-[#92958A]">
                        {vehicle?.registration_number ??
                          "Registration unavailable"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        statusStyles[job.status] ??
                        statusStyles.pending
                      }`}
                    >
                      {statusLabels[job.status] ?? job.status}
                    </span>
                  </div>

                  {/* Job details */}

                  <div className="mt-4 grid gap-3 border-t border-[#EEECE5] pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                        Repair work
                      </p>

                      <p className="mt-1 text-xs font-semibold text-[#475448]">
                        {job.title}
                      </p>

                      {job.description && (
                        <p className="mt-1 text-[11px] leading-5 text-[#777D72]">
                          {job.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                        Assigned mechanic
                      </p>

                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#475448]">
                        <UserRound size={13} />

                        {job.mechanic?.full_name ??
                          "Not assigned"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                        Estimated cost
                      </p>

                      <p className="mt-1 text-xs font-bold text-[#344337]">
                        {job.estimated_cost == null
                          ? "Not specified"
                          : currency.format(
                              Number(job.estimated_cost)
                            )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                        Priority
                      </p>

                      <p className="mt-1 text-xs font-semibold capitalize text-[#475448]">
                        {job.priority}
                      </p>
                    </div>

                    {job.actual_cost != null && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                          Actual cost
                        </p>

                        <p className="mt-1 text-xs font-bold text-[#344337]">
                          {currency.format(
                            Number(job.actual_cost)
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Admin: Assign mechanic */}

                  {role === "admin" &&
                    (job.status === "pending" ||
                      job.status === "assigned") && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <select
                          value={mechanicId}
                          onChange={(event) =>
                            setAssignments((current) => ({
                              ...current,
                              [job.id]: event.target.value,
                            }))
                          }
                          className="min-w-0 flex-1 rounded-lg border border-[#E8E3D8] bg-white px-3 py-2 text-xs text-[#344337] outline-none focus:border-[#63866B]"
                        >
                          <option value="">
                            Select mechanic
                          </option>

                          {mechanics.map((mechanic) => (
                            <option
                              key={mechanic.id}
                              value={mechanic.id}
                            >
                              {mechanic.full_name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={isBusy || !mechanicId}
                          onClick={() =>
                            void runAction(
                              job.id,
                              "assign_repair_job",
                              {
                                p_repair_job_id: job.id,
                                p_mechanic_id: mechanicId,
                              }
                            )
                          }
                          className={demoButtonClass}
                        >
                          {isBusy ? "Assigning..." : "Assign"}
                        </button>
                      </div>
                    )}

                  {/* Mechanic: Start repair */}

                  {role === "mechanic" &&
                    job.mechanic?.id === userId &&
                    job.status === "assigned" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void runAction(
                            job.id,
                            "start_repair_job",
                            {
                              p_repair_job_id: job.id,
                            }
                          )
                        }
                        className={`${demoButtonClass} mt-4`}
                      >
                        <Wrench size={14} />
                        {isBusy ? "Starting..." : "Start repair"}
                      </button>
                    )}

                  {/* Mechanic: Complete repair */}

                  {role === "mechanic" &&
                    job.mechanic?.id === userId &&
                    job.status === "in_progress" && (
                      <div className="mt-4 space-y-2">
                        <textarea
                          value={notes[job.id] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [job.id]: event.target.value,
                            }))
                          }
                          placeholder="Enter completion notes (minimum 10 characters)"
                          rows={3}
                          className="w-full rounded-lg border border-[#E8E3D8] bg-white p-3 text-xs text-[#344337] outline-none focus:border-[#63866B]"
                        />

                        <button
                          type="button"
                          disabled={
                            isBusy ||
                            (notes[job.id] ?? "").trim().length < 10
                          }
                          onClick={() =>
                            void runAction(
                              job.id,
                              "complete_repair_job",
                              {
                                p_repair_job_id: job.id,
                                p_note: notes[job.id].trim(),
                              }
                            )
                          }
                          className={demoButtonClass}
                        >
                          {isBusy
                            ? "Saving..."
                            : "Mark complete"}
                        </button>
                      </div>
                    )}

                  {/* Admin / QC: Verify or reject */}

                  {(role === "admin" ||
                    role === "quality_controller") &&
                    job.status === "completed" && (
                      <div className="mt-4 space-y-2">
                        <textarea
                          value={notes[job.id] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [job.id]: event.target.value,
                            }))
                          }
                          placeholder="Enter QC verification notes (minimum 5 characters)"
                          rows={3}
                          className="w-full rounded-lg border border-[#E8E3D8] bg-white p-3 text-xs text-[#344337] outline-none focus:border-[#63866B]"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              isBusy ||
                              (notes[job.id] ?? "").trim().length < 5
                            }
                            onClick={() =>
                              void runAction(
                                job.id,
                                "verify_repair_job",
                                {
                                  p_repair_job_id: job.id,
                                  p_approved: true,
                                  p_notes: notes[job.id].trim(),
                                }
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-[#26804B] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1F6B3E] disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            Verify repair
                          </button>

                          <button
                            type="button"
                            disabled={
                              isBusy ||
                              (notes[job.id] ?? "").trim().length < 5
                            }
                            onClick={() =>
                              void runAction(
                                job.id,
                                "verify_repair_job",
                                {
                                  p_repair_job_id: job.id,
                                  p_approved: false,
                                  p_notes: notes[job.id].trim(),
                                }
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-[#D9B6A8] bg-white px-4 py-2.5 text-xs font-bold text-[#A34D37] transition hover:bg-[#FFF5F1] disabled:opacity-50"
                          >
                            Reject repair
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Repair history */}

                  <div className="mt-4 border-t border-[#EEECE5] pt-3">
                    <button
                      type="button"
                      onClick={() => void showHistory(job.id)}
                      className="flex items-center gap-2 text-xs font-semibold text-[#63866B] transition hover:text-[#344337]"
                    >
                      <History size={14} />

                      {historyJobId === job.id
                        ? "Hide repair history"
                        : "View repair history"}
                    </button>

                    {historyJobId === job.id && (
                      <div className="mt-3 space-y-3">
                        {historyLoading ? (
                          <p className="text-xs text-[#92958A]">
                            Loading history...
                          </p>
                        ) : history.length === 0 ? (
                          <p className="text-xs text-[#92958A]">
                            No history records found.
                          </p>
                        ) : (
                          history.map((item) => (
                            <div
                              key={item.id}
                              className="border-l-2 border-[#A6B9A4] pl-3"
                            >
                              <p className="text-xs font-bold capitalize text-[#344337]">
                                {item.status?.replaceAll(
                                  "_",
                                  " "
                                ) ?? "Update"}
                              </p>

                              <p className="mt-1 text-xs text-[#697267]">
                                {item.note ?? "No note"}
                              </p>

                              <p className="mt-1 text-[10px] text-[#92958A]">
                                {new Date(
                                  item.created_at
                                ).toLocaleString("en-IN")}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
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
