
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Star,
  X,
  RefreshCw,
  AlertCircle,
  Clock3,
} from "lucide-react";

import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
} from "@/app/_components/DemoModuleShell";

import { createClient } from "@/lib/supabase/client";
import { getInspectionActor } from "@/lib/supabase/staff";

type SafetyStatus = "Cleared" | "Hold" | "Not assessed";

type Report = {
  id: string;
  reportNumber: string;
  vehicle: string;
  registration: string;
  completed: string;
  status: string;
  cosmeticScore: number | null;
  safety: SafetyStatus;
  criticalIssues: number;
  saleReady: boolean | null;
  summary: string[];
  reviewNotes: string[];
};

type InspectionRow = {
  id: string;
  vehicle_id: string;
  inspector_id: string;
  status: string;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
};

type VehicleRow = {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  variant: string | null;
};

type RatingRow = {
  inspection_id: string;
  cosmetic_score: number | null;
  critical_failures: number | null;
  safety_clearance: string | null;
  sale_ready: boolean | null;
};

type CheckpointRow = {
  inspection_id: string;
  checkpoint_no: number;
  result_status: string | null;
  issue_description: string | null;
  observation: string | null;
  recorded_value: string | null;
  expected_value: string | null;
};

type CheckpointDefinition = {
  checkpoint_no: number;
  name: string;
  section_no: number;
  classification: string;
};

type ReviewRow = {
  inspection_id: string;
  notes: string | null;
  status: string | null;
  review_type: string | null;
  reviewed_at: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getSafetyStatus(value: string | null | undefined): SafetyStatus {
  if (value === "cleared") return "Cleared";
  if (value === "hold" || value === "not_cleared") return "Hold";
  return "Not assessed";
}

function getInspectionLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getReportNumber(id: string) {
  return `RPT-${id.slice(0, 8).toUpperCase()}`;
}

function getVehicleName(vehicle?: VehicleRow) {
  if (!vehicle) return "Vehicle details unavailable";

  return [vehicle.make, vehicle.model, vehicle.variant]
    .filter(Boolean)
    .join(" · ");
}

function getCheckpointSummary(
  results: CheckpointRow[],
  definitions: Map<number, CheckpointDefinition>
) {
  if (results.length === 0) {
    return ["No checkpoint results have been recorded."];
  }

  return results.map((result) => {
    const definition = definitions.get(result.checkpoint_no);
    const name = definition?.name ?? `Checkpoint ${result.checkpoint_no}`;

    const details = [
      result.issue_description,
      result.observation,
    ].filter(Boolean);

    const measurement =
      result.recorded_value || result.expected_value
        ? `Recorded: ${result.recorded_value || "—"} · Expected: ${
            result.expected_value || "—"
          }`
        : "";

    const status = result.result_status
      ? getInspectionLabel(result.result_status)
      : "Not recorded";

    return [
      `${name}: ${status}`,
      ...details,
      measurement,
    ]
      .filter(Boolean)
      .join(" · ");
  });
}

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const actor = await getInspectionActor(supabase);

      if (!actor) {
        throw new Error("Your staff account could not be verified.");
      }

      const reportStatuses = [
        "submitted",
        "qc_pending",
        "repair_required",
        "approved",
        "rejected",
      ];

      const { data: inspections, error: inspectionsError } = await supabase
        .from("inspections")
        .select(
          "id, vehicle_id, inspector_id, status, submitted_at, completed_at, created_at, notes"
        )
        .in("status", reportStatuses)
        .order("created_at", { ascending: false });

      if (inspectionsError) {
        throw new Error(
          `Unable to load inspections: ${inspectionsError.message}`
        );
      }

      const inspectionRows = (inspections ?? []) as InspectionRow[];

      if (inspectionRows.length === 0) {
        setReports([]);
        return;
      }

      const inspectionIds = inspectionRows.map((item) => item.id);
      const vehicleIds = [
        ...new Set(inspectionRows.map((item) => item.vehicle_id)),
      ];

      const [
        vehiclesResult,
        ratingsResult,
        checkpointsResult,
        definitionsResult,
        reviewsResult,
      ] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, registration_number, make, model, variant")
          .in("id", vehicleIds),

        supabase
          .from("vehicle_ratings")
          .select(
            "inspection_id, cosmetic_score, critical_failures, safety_clearance, sale_ready"
          )
          .in("inspection_id", inspectionIds),

        supabase
          .from("checkpoint_results")
          .select(
            "inspection_id, checkpoint_no, result_status, issue_description, observation, recorded_value, expected_value"
          )
          .in("inspection_id", inspectionIds),

        supabase
          .from("inspection_checkpoints")
          .select("checkpoint_no, name, section_no, classification"),

        supabase
          .from("quality_reviews")
          .select("inspection_id, notes, status, review_type, reviewed_at")
          .in("inspection_id", inspectionIds)
          .order("reviewed_at", { ascending: false }),
      ]);

      const queryErrors = [
        vehiclesResult.error,
        ratingsResult.error,
        checkpointsResult.error,
        definitionsResult.error,
        reviewsResult.error,
      ].filter(Boolean);

      if (queryErrors.length > 0) {
        throw new Error(queryErrors[0]?.message ?? "Unable to load report details.");
      }

      const vehicles = (vehiclesResult.data ?? []) as VehicleRow[];
      const ratings = (ratingsResult.data ?? []) as RatingRow[];
      const checkpointResults = (checkpointsResult.data ?? []) as CheckpointRow[];
      const checkpointDefinitions = (definitionsResult.data ??
        []) as CheckpointDefinition[];
      const reviews = (reviewsResult.data ?? []) as ReviewRow[];

      const vehicleMap = new Map(
        vehicles.map((vehicle) => [vehicle.id, vehicle])
      );

      const ratingMap = new Map(
        ratings.map((rating) => [rating.inspection_id, rating])
      );

      const definitionMap = new Map(
        checkpointDefinitions.map((item) => [item.checkpoint_no, item])
      );

      const nextReports: Report[] = inspectionRows.map((inspection) => {
        const vehicle = vehicleMap.get(inspection.vehicle_id);
        const rating = ratingMap.get(inspection.id);

        const results = checkpointResults.filter(
          (item) => item.inspection_id === inspection.id
        );

        const inspectionReviews = reviews.filter(
          (item) => item.inspection_id === inspection.id
        );

        const summary = getCheckpointSummary(results, definitionMap);

        if (inspection.notes?.trim()) {
          summary.push(`Inspection notes: ${inspection.notes.trim()}`);
        }

        return {
          id: inspection.id,
          reportNumber: getReportNumber(inspection.id),
          vehicle: getVehicleName(vehicle),
          registration: vehicle?.registration_number ?? "Registration unavailable",
          completed: formatDate(
            inspection.completed_at ||
              inspection.submitted_at ||
              inspection.created_at
          ),
          status: inspection.status,
          cosmeticScore: rating?.cosmetic_score ?? null,
          safety: getSafetyStatus(rating?.safety_clearance),
          criticalIssues: rating?.critical_failures ?? 0,
          saleReady: rating?.sale_ready ?? null,
          summary,
          reviewNotes: inspectionReviews
            .filter((review) => review.notes?.trim())
            .map((review) => {
              const date = formatDate(review.reviewed_at);
              const type = review.review_type
                ? getInspectionLabel(review.review_type)
                : "Quality review";

              return `${type} · ${date}: ${review.notes}`;
            }),
        };
      });

      setReports(nextReports);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load inspection reports."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const clearedCount = reports.filter(
    (report) => report.safety === "Cleared"
  ).length;

  const needsFollowUp = reports.filter(
    (report) =>
      report.criticalIssues > 0 ||
      report.safety === "Hold" ||
      report.status === "rejected" ||
      report.status === "repair_required"
  ).length;

  const ratedReports = reports.filter(
    (report) => report.cosmeticScore !== null
  );

  const averageRating =
    ratedReports.length > 0
      ? ratedReports.reduce(
          (total, report) => total + (report.cosmeticScore ?? 0),
          0
        ) / ratedReports.length
      : null;

  return (
    <DemoModulePage
      title="Inspection Reports"
      description="Review vehicle inspection records, condition scores and safety clearance decisions."
      icon={FileText}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard
          label="Total reports"
          value={reports.length}
          detail="Submitted and reviewed inspections"
          icon={FileText}
        />

        <DemoMetricCard
          label="Safety cleared"
          value={clearedCount}
          detail="Records with cleared safety status"
          icon={ShieldCheck}
        />

        <DemoMetricCard
          label="Follow-up required"
          value={needsFollowUp}
          detail="Critical issues, holds or rejected records"
          icon={ShieldAlert}
          accent="amber"
        />

        <DemoMetricCard
          label="Average cosmetic score"
          value={
            averageRating !== null
              ? `${averageRating.toFixed(1)} / 5`
              : "—"
          }
          detail={`${ratedReports.length} reports with a recorded score`}
          icon={Star}
          accent="orange"
        />
      </section>

      <DemoPanel
        title="Vehicle inspection reports"
        description="Condition score and safety clearance are separate inspection outcomes."
      >
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => void loadReports()}
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
              <p className="font-bold">Unable to load reports</p>
              <p className="mt-1 text-xs">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-xl border border-[#EEECE5] bg-[#FCFBF7]"
              />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8E3D8] bg-[#FCFBF7] px-5 py-12 text-center">
            <FileText size={30} className="text-[#A3AA9F]" />
            <h3 className="mt-3 text-sm font-bold text-[#344337]">
              No inspection reports yet
            </h3>
            <p className="mt-1 text-xs text-[#92958A]">
              Submitted inspections will appear here when report data is available.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <article
                key={report.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4 lg:flex-row lg:items-center"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-wide text-[#A27649]">
                    {report.reportNumber} · {report.completed}
                  </p>

                  <h3 className="mt-1 text-sm font-bold text-[#344337]">
                    {report.vehicle}
                  </h3>

                  <p className="mt-1 text-[10px] text-[#92958A]">
                    {report.registration}
                  </p>

                  <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#697267]">
                    <Clock3 size={12} />
                    {getInspectionLabel(report.status)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3EEDC] px-3 py-1.5 text-[11px] font-bold text-[#8A6A20]">
                    <Star size={13} className="fill-current" />
                    {report.cosmeticScore !== null
                      ? `${report.cosmeticScore.toFixed(1)} / 5`
                      : "Not rated"}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                      report.safety === "Cleared"
                        ? "bg-[#E7F4E6] text-[#26804B]"
                        : report.safety === "Hold"
                          ? "bg-[#FCE9E5] text-[#B44936]"
                          : "bg-[#F1F0EA] text-[#77796F]"
                    }`}
                  >
                    {report.safety === "Cleared" ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <ShieldAlert size={13} />
                    )}
                    Safety {report.safety}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedReport(report)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#244A36] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#345D45]"
                  >
                    View report <ArrowUpRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </DemoPanel>

      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10271C]/65 p-3 backdrop-blur-sm"
          onClick={() => setSelectedReport(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-preview-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[#FAF9F5] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#E8E3D8] p-5">
              <div>
                <p className="text-[10px] font-extrabold tracking-[1.5px] text-[#A95719]">
                  INSPECTION REPORT
                </p>

                <h2
                  id="report-preview-title"
                  className="mt-1 text-lg font-bold text-[#244A36]"
                >
                  {selectedReport.vehicle}
                </h2>

                <p className="mt-1 text-xs text-[#92958A]">
                  {selectedReport.reportNumber} · {selectedReport.registration}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                aria-label="Close report preview"
                className="rounded-lg p-2 text-[#697267] transition hover:bg-[#EEEDE4]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <ReportValue
                  label="Cosmetic score"
                  value={
                    selectedReport.cosmeticScore !== null
                      ? `${selectedReport.cosmeticScore.toFixed(1)} / 5`
                      : "Not rated"
                  }
                />

                <ReportValue
                  label="Safety clearance"
                  value={selectedReport.safety}
                />

                <ReportValue
                  label="Critical issues"
                  value={selectedReport.criticalIssues}
                />

                <ReportValue
                  label="Inspection date"
                  value={selectedReport.completed}
                />

                <ReportValue
                  label="Inspection status"
                  value={getInspectionLabel(selectedReport.status)}
                />

                <ReportValue
                  label="Sale readiness"
                  value={
                    selectedReport.saleReady === null
                      ? "Not recorded"
                      : selectedReport.saleReady
                        ? "Sale ready"
                        : "Not sale ready"
                  }
                />
              </div>

              <h3 className="mb-3 mt-6 text-sm font-bold text-[#244A36]">
                Checkpoint summary
              </h3>

              <ul className="space-y-2">
                {selectedReport.summary.map((item, index) => (
                  <li
                    key={`${selectedReport.id}-${index}`}
                    className="rounded-lg bg-white px-3 py-2.5 text-xs leading-5 text-[#526052]"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              {selectedReport.reviewNotes.length > 0 && (
                <>
                  <h3 className="mb-3 mt-6 text-sm font-bold text-[#244A36]">
                    Quality review notes
                  </h3>

                  <ul className="space-y-2">
                    {selectedReport.reviewNotes.map((item, index) => (
                      <li
                        key={`${selectedReport.id}-review-${index}`}
                        className="rounded-lg border border-[#E8E3D8] bg-[#F7F6F0] px-3 py-2.5 text-xs leading-5 text-[#526052]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DemoModulePage>
  );
}

function ReportValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-[#F0F1E9] p-3">
      <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#344337]">{value}</p>
    </div>
  );
}
