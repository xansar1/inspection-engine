
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  TriangleAlert,
  XCircle,
  RefreshCw,
  History,
  CarFront,
  UserRound,
  FileCheck,
  Clock3,
  AlertCircle,
  Wrench,
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

type InspectionStatus =
  | "submitted"
  | "qc_pending"
  | "repair_required"
  | "approved"
  | "rejected";

type Inspection = {
  id: string;
  status: InspectionStatus;
  created_at: string;
  submitted_at: string | null;
  inspector_id: string;
  vehicle_id: string;
  notes: string | null;
};

type Vehicle = {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  variant: string | null;
};

type Profile = {
  id: string;
  full_name: string;
};

type VehicleRating = {
  inspection_id: string;
  cosmetic_score: number | null;
  critical_failures: number;
  safety_clearance: string;
  sale_ready: boolean;
};

type Checkpoint = {
  checkpoint_no: number;
  section_no: number;
  name: string;
  classification: string;
  assessment_method: string;
};

type CheckpointResult = {
  id: string;
  inspection_id: string;
  checkpoint_no: number;
  result_status: string | null;
  issue_description: string | null;
  observation: string | null;
  applicable: boolean | null;
  expected_value: string | null;
  recorded_value: string | null;
};

type QualityReview = {
  id: string;
  inspection_id: string;
  reviewer_id: string;
  review_type: string;
  status: string;
  critical_variance_count: number;
  notes: string | null;
  reviewed_at: string;
};

type RepairJob = {
  id: string;
  inspection_id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  estimated_cost: number | null;
  assigned_mechanic_id: string | null;
  created_at: string;
};

type Mechanic = {
  id: string;
  full_name: string;
};

type Section = {
  section_no: number;
  name: string;
};

type Tab = "repairs" | "inspections" | "history";

const statusLabel: Record<string, string> = {
  submitted: "Awaiting QC",
  qc_pending: "Awaiting QC",
  repair_required: "Repair required",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  verified: "Verified",
  assigned: "Assigned",
  in_progress: "In progress",
  pending: "Pending",
};

const statusStyle: Record<string, string> = {
  submitted: "bg-[#FFF3E4] text-[#9A7026]",
  qc_pending: "bg-[#FFF3E4] text-[#9A7026]",
  repair_required: "bg-[#FFF0E0] text-[#B66A2B]",
  approved: "bg-[#E7F4E6] text-[#26804B]",
  verified: "bg-[#E7F4E6] text-[#26804B]",
  completed: "bg-[#E8EFFD] text-[#4265A5]",
  rejected: "bg-[#FCE9E5] text-[#B44936]",
  assigned: "bg-[#E8EFFD] text-[#4265A5]",
  in_progress: "bg-[#FFF0E0] text-[#B66A2B]",
  pending: "bg-[#FFF3E4] text-[#9A7026]",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
        statusStyle[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {statusLabel[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}

const dateFormat = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not available";

export default function QualityControlPage() {
  const supabase = useMemo(() => createClient(), []);

  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspectors, setInspectors] = useState<Profile[]>([]);
  const [ratings, setRatings] = useState<VehicleRating[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [results, setResults] = useState<CheckpointResult[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [reviews, setReviews] = useState<QualityReview[]>([]);
  const [repairs, setRepairs] = useState<RepairJob[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("repairs");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedInspection, setExpandedInspection] = useState("");
  const [historyInspection, setHistoryInspection] = useState("");

  const [filter, setFilter] = useState("all");

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

      const currentRole = actor.profile.role;
      setRole(currentRole);
      setUserId(actor.user.id);

      const isInspector = currentRole === "inspector";

      // Inspectors only load their own inspections.
      let inspectionQuery = supabase
        .from("inspections")
        .select(
          "id, status, created_at, submitted_at, inspector_id, vehicle_id, notes"
        )
        .order("created_at", { ascending: false });

      if (isInspector) {
        inspectionQuery = inspectionQuery.eq(
          "inspector_id",
          actor.user.id
        );
      } else {
        inspectionQuery = inspectionQuery.in("status", [
          "submitted",
          "qc_pending",
          "repair_required",
          "approved",
          "rejected",
        ]);
      }

      const { data: inspectionData, error: inspectionError } =
        await inspectionQuery;

      if (inspectionError) throw inspectionError;

      const inspectionRows =
        (inspectionData ?? []) as Inspection[];

      setInspections(inspectionRows);

      const inspectionIds = inspectionRows.map((item) => item.id);
      const vehicleIds = [
        ...new Set(inspectionRows.map((item) => item.vehicle_id)),
      ];
      const inspectorIds = [
        ...new Set(inspectionRows.map((item) => item.inspector_id)),
      ];

      if (inspectionIds.length === 0) {
        setVehicles([]);
        setInspectors([]);
        setRatings([]);
        setCheckpoints([]);
        setResults([]);
        setSections([]);
        setReviews([]);
        setRepairs([]);
        setMechanics([]);
        return;
      }

      const [
        vehicleResponse,
        inspectorResponse,
        ratingResponse,
        resultResponse,
        checkpointResponse,
        sectionResponse,
        reviewResponse,
        repairResponse,
      ] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, registration_number, make, model, variant")
          .in("id", vehicleIds),

        supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", inspectorIds),

        supabase
          .from("vehicle_ratings")
          .select(
            "inspection_id, cosmetic_score, critical_failures, safety_clearance, sale_ready"
          )
          .in("inspection_id", inspectionIds),

        supabase
          .from("checkpoint_results")
          .select(
            "id, inspection_id, checkpoint_no, result_status, issue_description, observation, applicable, expected_value, recorded_value"
          )
          .in("inspection_id", inspectionIds),

        supabase
          .from("inspection_checkpoints")
          .select(
            "checkpoint_no, section_no, name, classification, assessment_method"
          )
          .eq("is_active", true),

        supabase
          .from("inspection_sections")
          .select("section_no, name"),

        supabase
          .from("quality_reviews")
          .select(
            "id, inspection_id, reviewer_id, review_type, status, critical_variance_count, notes, reviewed_at"
          )
          .in("inspection_id", inspectionIds)
          .order("reviewed_at", { ascending: false }),

        supabase
          .from("repair_jobs")
          .select(
            "id, inspection_id, title, description, priority, status, estimated_cost, assigned_mechanic_id, created_at"
          )
          .in("inspection_id", inspectionIds)
          .order("created_at", { ascending: false }),
      ]);

      const responses = [
        vehicleResponse,
        inspectorResponse,
        ratingResponse,
        resultResponse,
        checkpointResponse,
        sectionResponse,
        reviewResponse,
        repairResponse,
      ];

      const failedResponse = responses.find(
        (response) => response.error
      );

      if (failedResponse?.error) {
        throw failedResponse.error;
      }

      setVehicles((vehicleResponse.data ?? []) as Vehicle[]);
      setInspectors((inspectorResponse.data ?? []) as Profile[]);
      setRatings((ratingResponse.data ?? []) as VehicleRating[]);
      setResults(
        (resultResponse.data ?? []) as CheckpointResult[]
      );
      setCheckpoints(
        (checkpointResponse.data ?? []) as Checkpoint[]
      );
      setSections((sectionResponse.data ?? []) as Section[]);
      setReviews((reviewResponse.data ?? []) as QualityReview[]);
      setRepairs((repairResponse.data ?? []) as RepairJob[]);

      if (currentRole === "admin") {
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
          : "Could not load quality control records."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const vehicleMap = useMemo(
    () => new Map(vehicles.map((item) => [item.id, item])),
    [vehicles]
  );

  const inspectorMap = useMemo(
    () => new Map(inspectors.map((item) => [item.id, item])),
    [inspectors]
  );

  const ratingMap = useMemo(
    () => new Map(ratings.map((item) => [item.inspection_id, item])),
    [ratings]
  );

  const checkpointMap = useMemo(
    () => new Map(checkpoints.map((item) => [item.checkpoint_no, item])),
    [checkpoints]
  );

  const sectionMap = useMemo(
    () => new Map(sections.map((item) => [item.section_no, item])),
    [sections]
  );

  const reviewsByInspection = useMemo(() => {
    const map = new Map<string, QualityReview[]>();

    reviews.forEach((review) => {
      const current = map.get(review.inspection_id) ?? [];
      current.push(review);
      map.set(review.inspection_id, current);
    });

    return map;
  }, [reviews]);

  const resultsByInspection = useMemo(() => {
    const map = new Map<string, CheckpointResult[]>();

    results.forEach((result) => {
      const current = map.get(result.inspection_id) ?? [];
      current.push(result);
      map.set(result.inspection_id, current);
    });

    return map;
  }, [results]);

  const inspectionsById = useMemo(
    () => new Map(inspections.map((item) => [item.id, item])),
    [inspections]
  );

  const pendingRepairJobs = repairs.filter(
    (job) => job.status === "completed"
  );

  const pendingInspections = inspections.filter(
    (item) =>
      item.status === "submitted" ||
      item.status === "qc_pending"
  );

  const approvedCount = inspections.filter(
    (item) => item.status === "approved"
  ).length;

  const rejectedCount = inspections.filter(
    (item) => item.status === "rejected"
  ).length;

  const pendingCount =
    pendingRepairJobs.length + pendingInspections.length;

  const verifiedCheckpointCount = results.filter(
    (item) => item.result_status === "pass"
  ).length;

  const filteredRepairs = pendingRepairJobs.filter((job) => {
    return filter === "all" || job.priority === filter;
  });

  const filteredInspections = pendingInspections.filter((item) => {
    return filter === "all" || item.status === filter;
  });

  const canReview = role === "admin" || role === "quality_controller";

  async function runAction(
    id: string,
    functionName: string,
    args: Record<string, unknown>
  ) {
    setBusyId(id);
    setError("");
    setMessage("");

    try {
      const { error: actionError } = await supabase.rpc(
        functionName as never,
        args as never
      );

      if (actionError) throw actionError;

      setMessage("Quality review saved successfully.");
      setNotes((current) => ({ ...current, [id]: "" }));

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Quality review could not be saved."
      );
    } finally {
      setBusyId("");
    }
  }

  const getCheckpointRows = (inspectionId: string) => {
    const inspectionResults =
      resultsByInspection.get(inspectionId) ?? [];

    return inspectionResults
      .filter((result) => result.applicable !== false)
      .map((result) => ({
        result,
        checkpoint: checkpointMap.get(result.checkpoint_no),
      }))
      .sort(
        (a, b) =>
          (a.checkpoint?.section_no ?? 0) -
          (b.checkpoint?.section_no ?? 0)
      );
  };

  const getInspectionHistory = (inspectionId: string) =>
    reviewsByInspection.get(inspectionId) ?? [];

  return (
    <DemoModulePage
      title="Quality Control"
      description="Review completed repairs, inspect safety-critical results and manage final quality approval."
      icon={ShieldCheck}
      modeLabel="LIVE DATA"
      notice="Live inspections, repair verification and quality reviews connected through Supabase."
    >
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

      {/* Dashboard metrics */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard
          label="Awaiting QC"
          value={pendingCount}
          detail="Repairs and inspections awaiting review"
          icon={ClipboardCheck}
          accent="amber"
        />

        <DemoMetricCard
          label="Approved inspections"
          value={approvedCount}
          detail="Final inspection approvals"
          icon={CheckCircle2}
        />

        <DemoMetricCard
          label="Rejected inspections"
          value={rejectedCount}
          detail="Returned for further attention"
          icon={XCircle}
          accent="orange"
        />

        <DemoMetricCard
          label="Passed checkpoints"
          value={verifiedCheckpointCount}
          detail="Recorded passing inspection results"
          icon={ShieldCheck}
          accent="green"
        />
      </section>

      {/* Navigation tabs */}

      <div className="flex flex-wrap gap-2">
        {[
          ...(canReview
            ? [{ id: "repairs" as Tab, label: "Repair Verification", icon: Wrench }]
            : []),
          ...(canReview
            ? [{ id: "inspections" as Tab, label: "Final Inspection Review", icon: ClipboardCheck }]
            : []),
          { id: "history" as Tab, label: "QC History", icon: History },
        ].map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setFilter("all");
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                activeTab === tab.id
                  ? "bg-[#183D2D] text-white"
                  : "border border-[#E8E3D8] bg-white text-[#526052] hover:bg-[#F7F5EF]"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className={`${demoSubtleButtonClass} ml-auto`}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Repair verification */}

      {activeTab === "repairs" && canReview && (
        <DemoPanel
          title="Repair verification queue"
          description="Review completed repair work. Approved repairs become verified; rejected repairs return to assigned status."
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#92958A]">
              {loading
                ? "Loading..."
                : `${filteredRepairs.length} completed repair jobs`}
            </p>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-lg border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-2 text-xs text-[#344337]"
            >
              <option value="all">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-[#92958A]">
              Loading repair verification records...
            </p>
          ) : filteredRepairs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DDD8CC] bg-[#FCFBF7] px-4 py-12 text-center">
              <ShieldCheck
                size={32}
                className="mx-auto text-[#A27649]"
              />
              <h3 className="mt-3 text-sm font-bold text-[#344337]">
                No repairs awaiting verification
              </h3>
              <p className="mt-1 text-xs text-[#92958A]">
                Completed repair jobs will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredRepairs.map((job) => {
                const inspection = inspectionsById.get(
                  job.inspection_id
                );
                const vehicle = inspection
                  ? vehicleMap.get(inspection.vehicle_id)
                  : undefined;

                const isBusy = busyId === job.id;

                return (
                  <article
                    key={job.id}
                    className="rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold tracking-wide text-[#A27649]">
                          REPAIR-{job.id.slice(0, 8).toUpperCase()}
                        </p>

                        <h3 className="mt-1 text-sm font-bold text-[#344337]">
                          {vehicle
                            ? `${vehicle.make} ${vehicle.model}`
                            : "Vehicle details unavailable"}
                        </h3>

                        <p className="mt-1 text-[10px] text-[#92958A]">
                          {vehicle?.registration_number ?? "Registration unavailable"}
                        </p>
                      </div>

                      <StatusBadge status={job.status} />
                    </div>

                    <div className="mt-4 grid gap-3 border-t border-[#EEECE5] pt-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                          Repair work
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#475448]">
                          {job.title}
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

                      {job.description && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-[#697267]">
                            {job.description}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <textarea
                        rows={3}
                        value={notes[job.id] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [job.id]: event.target.value,
                          }))
                        }
                        placeholder="Enter repair verification notes (minimum 5 characters)"
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
                          className="inline-flex items-center gap-2 rounded-xl border border-[#D9B6A8] bg-white px-4 py-2.5 text-xs font-bold text-[#A34D37] disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          Reject repair
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </DemoPanel>
      )}

      {/* Final inspection review */}

      {activeTab === "inspections" && canReview && (
        <DemoPanel
          title="Final inspection review"
          description="Review submitted inspections, recorded checkpoint results and vehicle safety ratings before making a final decision."
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#92958A]">
              {loading
                ? "Loading..."
                : `${filteredInspections.length} inspections awaiting final review`}
            </p>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-lg border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-2 text-xs text-[#344337]"
            >
              <option value="all">All</option>
              <option value="submitted">Submitted</option>
              <option value="qc_pending">QC pending</option>
            </select>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-[#92958A]">
              Loading inspections...
            </p>
          ) : filteredInspections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DDD8CC] bg-[#FCFBF7] px-4 py-12 text-center">
              <ClipboardCheck
                size={32}
                className="mx-auto text-[#A27649]"
              />
              <h3 className="mt-3 text-sm font-bold text-[#344337]">
                No inspections awaiting final review
              </h3>
              <p className="mt-1 text-xs text-[#92958A]">
                Submitted inspections will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInspections.map((inspection) => {
                const vehicle = vehicleMap.get(
                  inspection.vehicle_id
                );

                const rating = ratingMap.get(inspection.id);

                const inspector = inspectorMap.get(
                  inspection.inspector_id
                );

                const checkpointRows = getCheckpointRows(
                  inspection.id
                );

                const inspectionReviews = getInspectionHistory(
                  inspection.id
                );

                const expanded =
                  expandedInspection === inspection.id;

                const isBusy = busyId === inspection.id;

                const criticalResults = checkpointRows.filter(
                  ({ checkpoint }) =>
                    checkpoint?.classification === "Critical" ||
                    checkpoint?.classification === "Mixed"
                );

                const notRecorded = checkpointRows.filter(
                  ({ result }) => !result.result_status
                ).length;

                return (
                  <article
                    key={inspection.id}
                    className="rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold tracking-wide text-[#A27649]">
                          INSPECTION-{inspection.id.slice(0, 8).toUpperCase()}
                        </p>

                        <h3 className="mt-1 text-sm font-bold text-[#344337]">
                          {vehicle
                            ? `${vehicle.make} ${vehicle.model}`
                            : "Vehicle details unavailable"}
                        </h3>

                        <p className="mt-1 text-[10px] text-[#92958A]">
                          {vehicle?.registration_number ?? "Registration unavailable"}
                        </p>
                      </div>

                      <StatusBadge status={inspection.status} />
                    </div>

                    <div className="mt-4 grid gap-3 border-t border-[#EEECE5] pt-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                          Inspector
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#475448]">
                          {inspector?.full_name ?? "Not available"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                          Safety clearance
                        </p>
                        <p className="mt-1 text-xs font-semibold capitalize text-[#475448]">
                          {rating?.safety_clearance ?? "Not available"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                          Critical failures
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#A34D37]">
                          {rating?.critical_failures ?? "Not available"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                          Sale readiness
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#475448]">
                          {rating
                            ? rating.sale_ready
                              ? "Sale ready"
                              : "Not sale ready"
                            : "Not calculated"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedInspection(
                            expanded ? "" : inspection.id
                          )
                        }
                        className={demoSubtleButtonClass}
                      >
                        <FileCheck size={14} />
                        {expanded
                          ? "Hide checklist"
                          : "View inspection checklist"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setHistoryInspection(
                            historyInspection === inspection.id
                              ? ""
                              : inspection.id
                          )
                        }
                        className={demoSubtleButtonClass}
                      >
                        <History size={14} />
                        Review history
                      </button>
                    </div>

                    {expanded && (
                      <div className="mt-4 space-y-4 rounded-xl border border-[#E8E3D8] bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-[#344337]">
                            Recorded checkpoint results
                          </h4>

                          <div className="flex flex-wrap gap-2 text-[10px] text-[#92958A]">
                            <span>
                              {checkpointRows.length} applicable records
                            </span>
                            <span>·</span>
                            <span>
                              {notRecorded} not recorded
                            </span>
                          </div>
                        </div>

                        {checkpointRows.length === 0 ? (
                          <p className="py-5 text-center text-xs text-[#92958A]">
                            No applicable checkpoint results were found.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {checkpointRows.map(
                              ({ result, checkpoint }) => {
                                const sectionName = checkpoint
                                  ? sectionMap.get(
                                      checkpoint.section_no
                                    )?.name
                                  : "Other";

                                return (
                                  <div
                                    key={result.id}
                                    className="border-b border-[#F0EEE7] pb-3 last:border-0"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <p className="text-[10px] font-semibold text-[#A27649]">
                                          {sectionName}
                                        </p>

                                        <p className="mt-1 text-xs font-semibold text-[#344337]">
                                          {checkpoint?.name ??
                                            `Checkpoint ${result.checkpoint_no}`}
                                        </p>

                                        {checkpoint && (
                                          <p className="mt-1 text-[10px] text-[#92958A]">
                                            {checkpoint.classification}
                                          </p>
                                        )}
                                      </div>

                                      <span
                                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                          result.result_status === "pass"
                                            ? "bg-[#E7F4E6] text-[#26804B]"
                                            : result.result_status === "fail"
                                              ? "bg-[#FCE9E5] text-[#B44936]"
                                              : "bg-[#F1F0EC] text-[#777777]"
                                        }`}
                                      >
                                        {result.result_status
                                          ? result.result_status.toUpperCase()
                                          : "NOT RECORDED"}
                                      </span>
                                    </div>

                                    {(result.expected_value ||
                                      result.recorded_value) && (
                                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        <p className="text-[10px] text-[#697267]">
                                          Expected:{" "}
                                          {result.expected_value ?? "—"}
                                        </p>
                                        <p className="text-[10px] text-[#697267]">
                                          Recorded:{" "}
                                          {result.recorded_value ?? "—"}
                                        </p>
                                      </div>
                                    )}

                                    {result.observation && (
                                      <p className="mt-2 text-xs text-[#697267]">
                                        Observation: {result.observation}
                                      </p>
                                    )}

                                    {result.issue_description && (
                                      <p className="mt-2 text-xs text-[#A34D37]">
                                        Issue: {result.issue_description}
                                      </p>
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}

                        {rating && (
                          <div className="rounded-lg bg-[#F7F5EF] p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#697267]">
                              Vehicle rating
                            </p>

                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                              <p className="text-xs text-[#475448]">
                                Cosmetic score:{" "}
                                {rating.cosmetic_score ?? "Not available"}
                              </p>

                              <p className="text-xs text-[#475448]">
                                Critical failures:{" "}
                                {rating.critical_failures}
                              </p>

                              <p className="text-xs text-[#475448]">
                                Safety: {rating.safety_clearance}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {historyInspection === inspection.id && (
                      <div className="mt-4 rounded-xl border border-[#E8E3D8] bg-white p-4">
                        <h4 className="text-xs font-bold text-[#344337]">
                          Quality review history
                        </h4>

                        {inspectionReviews.length === 0 ? (
                          <p className="mt-3 text-xs text-[#92958A]">
                            No review history available.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {inspectionReviews.map((review) => (
                              <div
                                key={review.id}
                                className="border-l-2 border-[#A6B9A4] pl-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-bold capitalize text-[#344337]">
                                    {review.review_type.replaceAll(
                                      "_",
                                      " "
                                    )}
                                  </p>

                                  <StatusBadge status={review.status} />
                                </div>

                                <p className="mt-1 text-xs text-[#697267]">
                                  {review.notes ?? "No notes"}
                                </p>

                                <p className="mt-1 text-[10px] text-[#92958A]">
                                  {dateFormat(review.reviewed_at)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Final review actions */}

                    {canReview &&
                      (inspection.status === "submitted" ||
                        inspection.status === "qc_pending") && (
                        <div className="mt-4 space-y-2 border-t border-[#EEECE5] pt-4">
                          <textarea
                            rows={3}
                            value={notes[inspection.id] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [inspection.id]: event.target.value,
                              }))
                            }
                            placeholder="Enter final QC review notes (minimum 5 characters)"
                            className="w-full rounded-lg border border-[#E8E3D8] bg-white p-3 text-xs text-[#344337] outline-none focus:border-[#63866B]"
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={
                                isBusy ||
                                !rating ||
                                (notes[inspection.id] ?? "").trim().length < 5
                              }
                              onClick={() =>
                                void runAction(
                                  inspection.id,
                                  "finalize_quality_review",
                                  {
                                    p_inspection_id: inspection.id,
                                    p_approved: true,
                                    p_notes: notes[inspection.id].trim(),
                                  }
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-xl bg-[#26804B] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1F6B3E] disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} />
                              Approve inspection
                            </button>

                            <button
                              type="button"
                              disabled={
                                isBusy ||
                                (notes[inspection.id] ?? "").trim().length < 5
                              }
                              onClick={() =>
                                void runAction(
                                  inspection.id,
                                  "finalize_quality_review",
                                  {
                                    p_inspection_id: inspection.id,
                                    p_approved: false,
                                    p_notes: notes[inspection.id].trim(),
                                  }
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-xl border border-[#D9B6A8] bg-white px-4 py-2.5 text-xs font-bold text-[#A34D37] disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              Reject inspection
                            </button>
                          </div>

                          {!rating && (
                            <p className="text-[10px] text-[#A34D37]">
                              A persisted vehicle rating is required before final review.
                            </p>
                          )}

                          {rating &&
                            (rating.safety_clearance !== "cleared" ||
                              rating.critical_failures !== 0) && (
                              <p className="flex items-center gap-2 text-[10px] text-[#A34D37]">
                                <AlertCircle size={13} />
                                Approval is blocked by the recorded safety rating. Rejection remains available.
                              </p>
                            )}
                        </div>
                      )}

                    {inspection.notes && (
                      <div className="mt-3 rounded-lg bg-[#F7F5EF] p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                          Inspector notes
                        </p>
                        <p className="mt-1 text-xs text-[#697267]">
                          {inspection.notes}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </DemoPanel>
      )}

      {/* Inspector's own inspection and QC history */}

      {activeTab === "history" && (
        <DemoPanel
          title={
            role === "inspector"
              ? "My inspection QC history"
              : "Quality review history"
          }
          description={
            role === "inspector"
              ? "Review your inspections, QC decisions and reviewer feedback."
              : "Review recorded quality decisions and their notes."
          }
        >
          {loading ? (
            <p className="py-10 text-center text-sm text-[#92958A]">
              Loading review history...
            </p>
          ) : inspections.length === 0 ? (
            <div className="py-12 text-center">
              <History
                size={30}
                className="mx-auto text-[#A27649]"
              />
              <h3 className="mt-3 text-sm font-bold text-[#344337]">
                No inspection history found
              </h3>
            </div>
          ) : (
            <div className="space-y-4">
              {inspections.map((inspection) => {
                const vehicle = vehicleMap.get(
                  inspection.vehicle_id
                );

                const inspectionReviews = getInspectionHistory(
                  inspection.id
                );

                return (
                  <article
                    key={inspection.id}
                    className="rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold tracking-wide text-[#A27649]">
                          INSPECTION-{inspection.id.slice(0, 8).toUpperCase()}
                        </p>

                        <h3 className="mt-1 text-sm font-bold text-[#344337]">
                          {vehicle
                            ? `${vehicle.make} ${vehicle.model}`
                            : "Vehicle details unavailable"}
                        </h3>

                        <p className="mt-1 text-[10px] text-[#92958A]">
                          {vehicle?.registration_number ?? "Registration unavailable"}
                        </p>
                      </div>

                      <StatusBadge status={inspection.status} />
                    </div>

                    {inspectionReviews.length === 0 ? (
                      <p className="mt-4 text-xs text-[#92958A]">
                        No QC review has been recorded for this inspection.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3 border-t border-[#EEECE5] pt-4">
                        {inspectionReviews.map((review) => (
                          <div
                            key={review.id}
                            className="border-l-2 border-[#A6B9A4] pl-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-bold capitalize text-[#344337]">
                                {review.review_type.replaceAll(
                                  "_",
                                  " "
                                )}
                              </p>

                              <StatusBadge status={review.status} />
                            </div>

                            <p className="mt-2 text-xs text-[#697267]">
                              {review.notes ?? "No reviewer notes"}
                            </p>

                            <p className="mt-1 text-[10px] text-[#92958A]">
                              {dateFormat(review.reviewed_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </DemoPanel>
      )}
    </DemoModulePage>
  );
}
