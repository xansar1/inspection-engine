"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bike,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Search,
  Save,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
  demoButtonClass,
  demoSubtleButtonClass,
} from "@/app/_components/DemoModuleShell";
import CheckpointAssessmentCard, {
  type LocalEvidence,
  type WorkshopMechanic,
} from "./CheckpointAssessmentCard";
import {
  createEmptyAssessment,
  createEmptyInspectionSession,
  inspectionSessionSchema,
  hasRequiredEvidence,
  isAssessmentComplete,
  isAssessmentStarted,
  isCriticalFailure,
  sourceSectionLabels,
  type CheckpointAssessment,
  type InspectionChecklistData,
  type InspectionCheckpoint,
  type InspectionSessionState,
} from "./checklist-model";
import { filterCheckpointsForVehicle } from "./vehicle-applicability";
import { getInspectionChecklist } from "@/lib/supabase/checklist";
import { createClient } from "@/lib/supabase/client";
import { getInspectionActor, type InspectionActor } from "@/lib/supabase/staff";
import InspectionAdvisor from "./InspectionAdvisor";
import {
  buildInspectionAnalysis,
  type InspectionAnalysisRow,
} from "./inspection-analysis";

type CheckpointFilter = "all" | "pending" | "completed" | "failed" | "critical";

type InspectionVehicle = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  registration_number: string;
  vehicle_type: "motorcycle" | "scooter";
  engine_capacity: string | null;
  manufacturing_year: number | null;
  registration_year: number | null;
  chassis_number: string | null;
  engine_number: string | null;
  odometer_reading_km: number | null;
  has_abs: boolean;
  has_parking_brake: boolean;
  has_catalytic_converter: boolean;
};

type GpsCoordinates = {
  latitude: number;
  longitude: number;
};

type InspectionRecord = {
  id: string;
  vehicle_id: string;
  inspector_id: string;
  status:
    | "draft"
    | "in_progress"
    | "submitted"
    | "repair_required"
    | "qc_pending"
    | "approved"
    | "rejected"
    | "cancelled";
  started_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  applicability: Record<string, boolean | null> | null;
  progress: Record<string, number> | null;
  selected_mechanic_id: string | null;
  reinspection_of: string | null;
};

type StoredCheckpointResult = {
  id: string;
  checkpoint_no: number;
  result_status: CheckpointAssessment["resultStatus"];
  cosmetic_score: number | null;
  measured_value: number | null;
  measured_value_input: string | null;
  measured_unit: string | null;
  recorded_value: string | null;
  expected_value: string | null;
  match_status: CheckpointAssessment["matchStatus"];
  issue_description: string | null;
  observation: string | null;
  applicability_reason: string | null;
  count_value: string | null;
  is_disclosed: boolean | null;
  evidence_due: boolean;
  auto_value: string | null;
  applicable: boolean | null;
};

type StoredEvidence = {
  id: string;
  checkpoint_result_id: string;
  media_type: "photo" | "video";
  storage_path: string;
};

type StoredApplicabilityAuthorization = {
  checkpoint_no: number;
  reason: string;
  authorized_at: string;
};

type VehicleRatingRecord = {
  cosmetic_score: number | null;
  critical_failures: number;
  safety_clearance: "blocked" | "conditional" | "cleared";
  sale_ready: boolean;
};

type RepairJobRecord = {
  id: string;
  inspection_id: string;
  title: string;
  description: string | null;
  priority: "critical" | "high" | "normal" | "low";
  status:
    | "pending"
    | "assigned"
    | "in_progress"
    | "completed"
    | "verified"
    | "cancelled";
  assigned_mechanic_id: string | null;
};

function formatDuration(startedAt: string, now: number) {
  const totalSeconds = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 1000)
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${hours}h ${minutes}m ${seconds}s`
    : `${minutes}m ${seconds}s`;
}

function getAutoValue(
  checkpoint: InspectionCheckpoint,
  vehicle: InspectionVehicle,
  session: InspectionSessionState,
  gps: GpsCoordinates | null,
  now: number,
  mechanics: WorkshopMechanic[]
) {
  switch (checkpoint.checkpoint_no) {
    case 14:
      return vehicle.vehicle_type;
    case 15:
      return session.startedAt
        ? new Date(session.startedAt).toISOString()
        : "";
    case 16:
      return gps
        ? `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`
        : "";
    case 17:
      return gps
        ? `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`
        : "";
    case 18:
      return mechanics.find((mechanic) => mechanic.id === session.selectedMechanic)?.name ?? "";
    case 19:
      return session.startedAt
        ? formatDuration(session.startedAt, now)
        : "";
    default:
      return "";
  }
}

function assessmentFor(
  session: InspectionSessionState,
  checkpointNo: number
): CheckpointAssessment {
  return session.assessments[String(checkpointNo)] ?? createEmptyAssessment();
}

function isCheckpointComplete(
  checkpoint: InspectionCheckpoint,
  session: InspectionSessionState,
  vehicle: InspectionVehicle,
  gps: GpsCoordinates | null,
  now: number,
  evidence: LocalEvidence[],
  mechanics: WorkshopMechanic[],
  applicabilityAuthorized: boolean
) {
  const assessment = assessmentFor(session, checkpoint.checkpoint_no);
  const notApplicable =
    checkpoint.is_conditional &&
    session.applicability[String(checkpoint.checkpoint_no)] === false &&
    assessment.resultStatus === "not_applicable";
  return (
    isAssessmentComplete(
      checkpoint,
      assessment,
      session.applicability[String(checkpoint.checkpoint_no)],
      getAutoValue(checkpoint, vehicle, session, gps, now, mechanics)
    ) &&
    (notApplicable
      ? applicabilityAuthorized
      : hasRequiredEvidence(checkpoint.evidence_required, evidence))
  );
}

function isCheckpointFailed(
  checkpoint: InspectionCheckpoint,
  assessment: CheckpointAssessment
) {
  return (
    assessment.resultStatus === "fail" ||
    assessment.matchStatus === "mismatch" ||
    (checkpoint.assessment_method === "Present/Absent" &&
      assessment.recordedValue === "Absent")
  );
}

export default function InspectionChecklist() {
  const supabase = useMemo(() => createClient(), []);
  const [checklist, setChecklist] =
    useState<InspectionChecklistData | null>(null);
  const [actor, setActor] = useState<InspectionActor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [workspaceMode, setWorkspaceMode] = useState<"inspection" | "workflow">(
    "inspection"
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setAuthenticationRequired(false);
    setActor(null);
    setChecklist(null);
    setWorkspaceMode("inspection");

    void (async () => {
      let actorResolved = false;
      try {
        const authenticatedActor = await getInspectionActor(supabase);
        if (cancelled) return;
        if (!authenticatedActor) {
          setActor(null);
          setChecklist(null);
          setAuthenticationRequired(true);
          return;
        }

        actorResolved = true;
        setActor(authenticatedActor);
        setWorkspaceMode(
          authenticatedActor.profile.role === "mechanic" ||
            authenticatedActor.profile.role === "quality_controller"
            ? "workflow"
            : "inspection"
        );
        const loadedChecklist = await getInspectionChecklist(supabase);
        if (!cancelled) setChecklist(loadedChecklist);
      } catch (error: unknown) {
        if (cancelled) return;
        setChecklist(null);
        if (!actorResolved) setActor(null);
        setLoadError(
          error instanceof Error
            ? error.message
            : "The authenticated Supabase inspection workspace could not be loaded."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestId, supabase]);

  if (loading) {
    return (
      <DemoModulePage
        title="260-point Vehicle Inspection"
        description="Load the active inspection checklist from Supabase. Inspection results remain in this browser tab."
        icon={ClipboardCheck}
        modeLabel="AUTHENTICATING"
      >
        <DemoPanel title="Loading inspection checklist">
          <div
            className="flex items-center gap-3 py-6 text-sm text-[#697267]"
            role="status"
          >
            <Loader2 size={18} className="animate-spin text-[#315D40]" />
            Loading 22 sections and 260 active checkpoints from Supabase…
          </div>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  if (loadError && workspaceMode === "inspection") {
    return (
      <DemoModulePage
        title="260-point Vehicle Inspection"
        description="The inspection checklist could not be loaded from Supabase. No seed-data fallback was used."
        icon={ClipboardCheck}
        modeLabel="LIVE WORKFLOW"
      >
        <DemoPanel title="Checklist unavailable">
          <div
            className="rounded-xl border border-[#EBC4BA] bg-[#FCE9E5] p-4 text-sm text-[#9F4A3A]"
            role="alert"
          >
            <p className="font-semibold">Unable to load the live checklist.</p>
            <p className="mt-2 break-words">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => setRequestId((current) => current + 1)}
            className={`${demoButtonClass} mt-4`}
          >
            Retry checklist load
          </button>
          {actor &&
            (actor.profile.role === "mechanic" ||
              actor.profile.role === "quality_controller") && (
              <button
                type="button"
                onClick={() => setWorkspaceMode("workflow")}
                className={`${demoSubtleButtonClass} mt-4`}
              >
                Return to{" "}
                {actor.profile.role === "mechanic"
                  ? "assigned repair work"
                  : "quality control"}
              </button>
            )}
        </DemoPanel>
      </DemoModulePage>
    );
  }

  if (authenticationRequired) {
    return (
      <DemoModulePage
        title="260-point Vehicle Inspection"
        description="Sign in with Supabase Auth and use an active, provisioned workshop profile to access authorized inspection, repair, and quality workflows."
        icon={ClipboardCheck}
        modeLabel="AUTH REQUIRED"
        notice="Anonymous inspection access and writes are disabled."
      >
        <DemoPanel title="Authenticated staff access required">
          <p className="text-sm leading-6 text-[#697267]">
            Sign in with an active workshop account. If your account has no active staff profile, ask an administrator to provision one; no inspection data was loaded or written.
          </p>
          <Link href="/login" className={`${demoButtonClass} mt-4`}>
            Staff sign in
          </Link>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  if (!actor) return null;

  if (
    workspaceMode === "workflow" &&
    (actor.profile.role === "mechanic" ||
      actor.profile.role === "quality_controller")
  ) {
    return (
      <WorkshopWorkflowWorkspace
        actor={actor}
        supabase={supabase}
        onOpenInspection={() => setWorkspaceMode("inspection")}
      />
    );
  }

  if (
    !checklist ||
    checklist.sections.length === 0 ||
    checklist.checkpoints.length === 0
  ) {
    return (
      <DemoModulePage
        title="260-point Vehicle Inspection"
        description="No fallback checklist is available when Supabase returns an empty result."
        icon={ClipboardCheck}
        modeLabel="LIVE WORKFLOW"
      >
        <DemoPanel title="Checklist is empty">
          <div
            className="rounded-xl border border-[#E8E3D8] bg-[#FCFBF7] p-4 text-sm text-[#697267]"
            role="alert"
          >
            Supabase returned no inspection checklist rows.
          </div>
          <button
            type="button"
            onClick={() => setRequestId((current) => current + 1)}
            className={`${demoButtonClass} mt-4`}
          >
            Retry checklist load
          </button>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  return (
    <InspectionWorkspace
      inspectionChecklist={checklist}
      actor={actor}
      supabase={supabase}
      onOpenWorkshopWorkflow={() => setWorkspaceMode("workflow")}
    />
  );
}

function InspectionWorkspace({
  inspectionChecklist,
  actor,
  supabase,
  onOpenWorkshopWorkflow,
}: {
  inspectionChecklist: InspectionChecklistData;
  actor: InspectionActor;
  supabase: ReturnType<typeof createClient>;
  onOpenWorkshopWorkflow: () => void;
}) {
  const [vehicles, setVehicles] = useState<InspectionVehicle[]>([]);
  const [mechanics, setMechanics] = useState<WorkshopMechanic[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [vehicleRating, setVehicleRating] =
    useState<VehicleRatingRecord | null>(null);
  const [repairJobs, setRepairJobs] = useState<RepairJobRecord[]>([]);
  const [workflowNotes, setWorkflowNotes] = useState<Record<string, string>>({});
  const [workflowBusy, setWorkflowBusy] = useState("");
  const [session, setSession] = useState<InspectionSessionState>(
    createEmptyInspectionSession
  );
  const [evidenceByInspection, setEvidenceByInspection] = useState<
    Record<string, Record<string, LocalEvidence[]>>
  >({});
  const [applicabilityAuthorizations, setApplicabilityAuthorizations] =
    useState<Record<string, StoredApplicabilityAuthorization>>({});
  const [authorizingCheckpointNo, setAuthorizingCheckpointNo] =
    useState<number | null>(null);
  const [restoreRevision, setRestoreRevision] = useState(0);
  const [currentGps, setCurrentGps] = useState<GpsCoordinates | null>(null);
  const [activeSectionNo, setActiveSectionNo] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [savingMessage, setSavingMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locationCapturing, setLocationCapturing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [checkpointFilter, setCheckpointFilter] =
    useState<CheckpointFilter>("all");
  const [currentCheckpointNo, setCurrentCheckpointNo] = useState(1);
  const [analysisGenerated, setAnalysisGenerated] = useState(false);
  const [analysisGeneratedAt, setAnalysisGeneratedAt] = useState<string | null>(null);
  const objectUrls = useRef(new Set<string>());

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const finalizedAt = inspection?.completed_at ?? inspection?.submitted_at ?? null;
  const currentEvidence = useMemo(
    () => (inspection ? evidenceByInspection[inspection.id] ?? {} : {}),
    [evidenceByInspection, inspection]
  );

  useEffect(() => {
    let cancelled = false;
    setWorkspaceLoading(true);
    setWorkspaceError("");

    void (async () => {
      try {
        const [vehicleResult, mechanicResult] = await Promise.all([
          supabase
            .from("vehicles")
            .select(
              "id, make, model, variant, registration_number, vehicle_type, engine_capacity, manufacturing_year, registration_year, chassis_number, engine_number, odometer_reading_km, has_abs, has_parking_brake, has_catalytic_converter"
            )
            .order("registration_number"),
          supabase
            .from("profiles")
            .select("id, full_name")
            .eq("role", "mechanic")
            .eq("is_active", true)
            .order("full_name"),
        ]);
        if (vehicleResult.error) {
          throw new Error(`Vehicles could not be loaded: ${vehicleResult.error.message}`);
        }
        if (mechanicResult.error) {
          throw new Error(`Workshop mechanics could not be loaded: ${mechanicResult.error.message}`);
        }
        if (cancelled) return;

        const loadedVehicles = vehicleResult.data ?? [];
        setVehicles(loadedVehicles);
        setMechanics(
          (mechanicResult.data ?? []).map((mechanic) => ({
            id: mechanic.id,
            name: mechanic.full_name,
          }))
        );
        setSelectedVehicleId((current) =>
          loadedVehicles.some((vehicle) => vehicle.id === current)
            ? current
            : loadedVehicles[0]?.id ?? ""
        );
      } catch (error: unknown) {
        if (!cancelled) {
          setWorkspaceError(
            error instanceof Error
              ? error.message
              : "The authenticated workshop data could not be loaded."
          );
        }
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!selectedVehicleId) return;
    let cancelled = false;
    setRestoring(true);
    setWorkspaceError("");
    setInspection(null);
    setVehicleRating(null);
    setRepairJobs([]);
    setWorkflowNotes({});
    setSession(createEmptyInspectionSession());
    setCurrentGps(null);
    setApplicabilityAuthorizations({});
    setSavingMessage("");
    setDirty(false);
    setLocationMessage("");
    setActiveSectionNo(1);
    setCurrentCheckpointNo(1);

    void (async () => {
      try {
        const { data: inspections, error: inspectionError } = await supabase
          .from("inspections")
          .select(
            "id, vehicle_id, inspector_id, status, started_at, submitted_at, completed_at, gps_lat, gps_lng, applicability, progress, selected_mechanic_id, reinspection_of"
          )
          .eq("vehicle_id", selectedVehicleId)
          .eq("inspector_id", actor.profile.id)
          .in("status", [
            "draft",
            "in_progress",
            "submitted",
            "repair_required",
            "approved",
            "rejected",
          ])
          .order("started_at", { ascending: false })
          .limit(20);

        if (inspectionError) {
          throw new Error(`Open inspection could not be loaded: ${inspectionError.message}`);
        }
        const inspectionRows = (inspections ?? []) as InspectionRecord[];
        const savedInspection =
          inspectionRows.find((candidate) =>
            ["draft", "in_progress"].includes(candidate.status)
          ) ??
          inspectionRows[0] ??
          null;
        if (!savedInspection) {
          if (!cancelled) {
            setRepairJobs([]);
            setSavingMessage("No open inspection exists for this vehicle. Start one to begin.");
          }
          return;
        }

        const repairInspectionId =
          savedInspection.status === "repair_required"
            ? savedInspection.id
            : savedInspection.reinspection_of ?? savedInspection.id;
        const { data: repairRows, error: repairError } = await supabase
          .from("repair_jobs")
          .select(
            "id, inspection_id, title, description, priority, status, assigned_mechanic_id"
          )
          .eq("inspection_id", repairInspectionId)
          .order("created_at");
        if (repairError) {
          throw new Error(`Repair workflow could not be restored: ${repairError.message}`);
        }

        let restoredRating: VehicleRatingRecord | null = null;
        if (
          savedInspection.status === "submitted" ||
          savedInspection.status === "repair_required" ||
          savedInspection.status === "approved" ||
          savedInspection.status === "rejected"
        ) {
          const { data: rating, error: ratingError } = await supabase
            .from("vehicle_ratings")
            .select("cosmetic_score, critical_failures, safety_clearance, sale_ready")
            .eq("inspection_id", savedInspection.id)
            .maybeSingle();
          if (ratingError) {
            throw new Error(`Final vehicle rating could not be restored: ${ratingError.message}`);
          }
          if (!rating) {
            throw new Error("Submitted inspection is missing its persisted vehicle rating.");
          }
          restoredRating = rating as VehicleRatingRecord;
        }

        const { data: resultRows, error: resultsError } = await supabase
          .from("checkpoint_results")
          .select(
            "id, checkpoint_no, result_status, cosmetic_score, measured_value, measured_value_input, measured_unit, recorded_value, expected_value, match_status, issue_description, observation, applicability_reason, count_value, is_disclosed, evidence_due, auto_value, applicable"
          )
          .eq("inspection_id", savedInspection.id);
        if (resultsError) {
          throw new Error(`Saved checkpoint results could not be restored: ${resultsError.message}`);
        }

        const storedResults = (resultRows ?? []) as StoredCheckpointResult[];
        const applicability = { ...(savedInspection.applicability ?? {}) };
        const assessments: Record<string, CheckpointAssessment> = {};
        storedResults.forEach((result) => {
          const checkpointKey = String(result.checkpoint_no);
          if (result.applicable !== null) {
            applicability[checkpointKey] = result.applicable;
          }
          assessments[checkpointKey] = {
            resultStatus: result.result_status,
            cosmeticScore: result.cosmetic_score,
            measuredValue:
              result.measured_value_input ??
              (result.measured_value === null ? "" : String(result.measured_value)),
            measuredUnit: result.measured_unit ?? "",
            expectedValue: result.expected_value ?? "",
            recordedValue: result.recorded_value ?? "",
            matchStatus: result.match_status,
            isDisclosed: result.is_disclosed,
            countValue: result.count_value ?? "",
            issueDescription: result.issue_description ?? "",
            observation: result.observation ?? "",
            applicabilityReason: result.applicability_reason ?? "",
            evidenceDue: result.evidence_due,
          };
        });
        const restoredSession = inspectionSessionSchema.parse({
          startedAt: savedInspection.started_at,
          selectedMechanic: savedInspection.selected_mechanic_id ?? "",
          applicability,
          assessments,
        });

        const { data: authorizationRows, error: authorizationError } =
          await supabase
            .from("inspection_applicability_authorizations")
            .select("checkpoint_no, reason, authorized_at")
            .eq("inspection_id", savedInspection.id);
        if (authorizationError) {
          throw new Error(
            `Applicability approvals could not be restored: ${authorizationError.message}`
          );
        }
        const restoredAuthorizations = Object.fromEntries(
          ((authorizationRows ?? []) as StoredApplicabilityAuthorization[]).map(
            (authorization) => [
              String(authorization.checkpoint_no),
              authorization,
            ]
          )
        );

        const restoredEvidence: Record<string, LocalEvidence[]> = {};
        if (storedResults.length > 0) {
          const resultIdByCheckpoint = new Map(
            storedResults.map((result) => [result.id, result.checkpoint_no])
          );
          const { data: evidenceRows, error: evidenceError } = await supabase
            .from("evidence")
            .select("id, checkpoint_result_id, media_type, storage_path")
            .in(
              "checkpoint_result_id",
              storedResults.map((result) => result.id)
            );
          if (evidenceError) {
            throw new Error(`Saved evidence could not be restored: ${evidenceError.message}`);
          }

          const savedEvidence = (evidenceRows ?? []) as StoredEvidence[];
          const signedEvidence = await Promise.all(
            savedEvidence.map(async (evidence) => {
              const { data, error } = await supabase.storage
                .from("inspection-evidence")
                .createSignedUrl(evidence.storage_path, 3600);
              if (error) {
                throw new Error(`Evidence preview could not be loaded: ${error.message}`);
              }
              return {
                checkpointNo: resultIdByCheckpoint.get(
                  evidence.checkpoint_result_id
                ),
                item: {
                  id: evidence.id,
                  databaseId: evidence.id,
                  storagePath: evidence.storage_path,
                  name: evidence.storage_path.split("/").pop() ?? "Evidence",
                  mediaType: evidence.media_type,
                  previewUrl: data.signedUrl,
                } satisfies LocalEvidence,
              };
            })
          );
          signedEvidence.forEach(({ checkpointNo, item }) => {
            if (checkpointNo === undefined) return;
            const key = String(checkpointNo);
            restoredEvidence[key] = [...(restoredEvidence[key] ?? []), item];
          });
        }

        if (!cancelled) {
          setInspection(savedInspection);
          setVehicleRating(restoredRating);
          setRepairJobs((repairRows ?? []) as RepairJobRecord[]);
          setWorkflowNotes({});
          setSession(restoredSession);
          setApplicabilityAuthorizations(restoredAuthorizations);
          setDirty(false);
          setCurrentGps(
            savedInspection.gps_lat !== null && savedInspection.gps_lng !== null
              ? {
                  latitude: savedInspection.gps_lat,
                  longitude: savedInspection.gps_lng,
                }
              : null
          );
          setEvidenceByInspection((current) => ({
            ...current,
            [savedInspection.id]: restoredEvidence,
          }));
          setSavingMessage("Saved inspection progress restored from Supabase.");
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setWorkspaceError(
            error instanceof Error
              ? error.message
              : "Saved inspection data could not be restored."
          );
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actor.profile.id, restoreRevision, selectedVehicleId, supabase]);

  useEffect(() => {
    if (!inspection?.started_at || finalizedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [finalizedAt, inspection?.started_at]);

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      objectUrls.current.clear();
    },
    []
  );

  const checklistCheckpoints = inspectionChecklist.checkpoints;
  const selectedVehicleType = selectedVehicle?.vehicle_type;
  const activeCheckpoints = useMemo(
    () => selectedVehicleType
      ? filterCheckpointsForVehicle(
        checklistCheckpoints,
        selectedVehicleType
      )
      : [],
    [checklistCheckpoints, selectedVehicleType]
  );

  const currentSection = inspectionChecklist.sections.find(
    (section) => section.section_no === activeSectionNo
  );
  const currentSectionCheckpoints = activeCheckpoints.filter(
    (checkpoint) => checkpoint.section_no === activeSectionNo
  );
  const applicableCheckpoints = useMemo(
    () =>
      activeCheckpoints.filter(
        (checkpoint) =>
          !checkpoint.is_conditional ||
          session.applicability[String(checkpoint.checkpoint_no)] === true
      ),
    [activeCheckpoints, session.applicability]
  );
  const unresolvedApplicability = useMemo(
    () =>
      activeCheckpoints.filter(
        (checkpoint) => {
          if (!checkpoint.is_conditional) return false;
          const key = String(checkpoint.checkpoint_no);
          const applicability = session.applicability[key];
          return (
            applicability == null ||
            (applicability === false && !applicabilityAuthorizations[key])
          );
        }
      ),
    [activeCheckpoints, applicabilityAuthorizations, session.applicability]
  );
  const progressByCheckpoint = useMemo(() => {
    const result = new Map<number, boolean>();
    if (!selectedVehicle) return result;
    activeCheckpoints.forEach((checkpoint) => {
      result.set(
        checkpoint.checkpoint_no,
        isCheckpointComplete(
          checkpoint,
          session,
          selectedVehicle,
          currentGps,
          now,
          currentEvidence[String(checkpoint.checkpoint_no)] ?? [],
          mechanics,
          Boolean(
            applicabilityAuthorizations[String(checkpoint.checkpoint_no)]
          )
        )
      );
    });
    return result;
  }, [
    activeCheckpoints,
    currentEvidence,
    currentGps,
    now,
    selectedVehicle,
    mechanics,
    applicabilityAuthorizations,
    session,
  ]);
  const analysisRows = useMemo<InspectionAnalysisRow[]>(
    () => {
      if (!selectedVehicle) return [];
      return applicableCheckpoints.map((checkpoint) => {
        const key = String(checkpoint.checkpoint_no);
        const assessment = assessmentFor(session, checkpoint.checkpoint_no);
        const applicable = session.applicability[key];
        const autoValue = getAutoValue(
          checkpoint,
          selectedVehicle,
          session,
          currentGps,
          now,
          mechanics
        );
        const assessmentStarted = isAssessmentStarted(
          checkpoint,
          assessment,
          applicable,
          autoValue
        );
        const assessmentComplete = isAssessmentComplete(
          checkpoint,
          assessment,
          applicable,
          autoValue
        );
        const evidence = currentEvidence[key] ?? [];
        const evidenceComplete = hasRequiredEvidence(
          checkpoint.evidence_required,
          evidence
        );
        const evidenceDue =
          checkpoint.evidence_required !== "Not required" &&
          (assessmentStarted || assessment.evidenceDue) &&
          (!checkpoint.is_conditional || applicable === true);
        return {
          checkpoint,
          sectionLabel: sourceSectionLabels[checkpoint.section_no],
          sectionName: checkpoint.section_name,
          assessment,
          assessmentStarted,
          assessmentComplete,
          complete: assessmentComplete && evidenceComplete,
          evidenceDue,
          evidenceMissing: evidenceDue && !evidenceComplete,
        };
      });
    },
    [
      applicableCheckpoints,
      currentEvidence,
      currentGps,
      mechanics,
      now,
      selectedVehicle,
      session,
    ]
  );
  const completedRows = analysisRows.filter((row) => row.complete);
  const unassessedRows = analysisRows.filter((row) => !row.assessmentStarted);
  const inProgressRows = analysisRows.filter(
    (row) => row.assessmentStarted && !row.assessmentComplete
  );
  const assessedEvidencePendingRows = analysisRows.filter(
    (row) => row.assessmentComplete && !row.complete
  );
  const evidenceMissingRows = analysisRows.filter((row) => row.evidenceMissing);
  const completedCount = completedRows.length;
  const pendingCount = applicableCheckpoints.length - completedCount;
  const failedCritical = applicableCheckpoints.filter((checkpoint) =>
    isCriticalFailure(
      checkpoint,
      assessmentFor(session, checkpoint.checkpoint_no)
    )
  );
  const failedCriticalRows = analysisRows.filter((row) =>
    isCriticalFailure(row.checkpoint, row.assessment)
  );
  const outstandingRepairRows = analysisRows.filter((row) =>
    isCheckpointFailed(row.checkpoint, row.assessment)
  );
  const evidenceMissingCount = evidenceMissingRows.length;
  const overallProgress =
    applicableCheckpoints.length === 0
      ? 0
      : Math.round((completedCount / applicableCheckpoints.length) * 100);
  const inspectionComplete =
    applicableCheckpoints.length > 0 &&
    pendingCount === 0 &&
    unresolvedApplicability.length === 0;
  const eligibleForSubmission = Boolean(inspection && inspectionComplete);
  const saleReady = Boolean(vehicleRating?.sale_ready);
  const safetyStatus = vehicleRating
    ? vehicleRating.safety_clearance === "blocked"
      ? "Blocked"
      : vehicleRating.safety_clearance === "cleared"
        ? "Cleared"
        : "Conditional"
    : failedCritical.length > 0
      ? "Blocked"
      : "Pending";
  const cosmeticScores = applicableCheckpoints
    .filter(
      (checkpoint) =>
        checkpoint.classification === "Cosmetic" ||
        checkpoint.classification === "Mixed"
    )
    .map(
      (checkpoint) =>
        assessmentFor(session, checkpoint.checkpoint_no).cosmeticScore
    )
    .filter((score): score is number => score !== null);
  const calculatedCosmeticScore =
    inspectionComplete && cosmeticScores.length > 0
      ? cosmeticScores.reduce((total, score) => total + score, 0) /
        cosmeticScores.length
      : null;
  const averageCosmeticScore =
    vehicleRating?.cosmetic_score ?? calculatedCosmeticScore;
  const cosmeticObservations = applicableCheckpoints.filter((checkpoint) => {
    if (
      checkpoint.classification !== "Cosmetic" &&
      checkpoint.classification !== "Mixed"
    ) {
      return false;
    }
    return assessmentFor(session, checkpoint.checkpoint_no).cosmeticScore !== null;
  });
  const inspectionAnalysis = buildInspectionAnalysis({
    vehicleName: selectedVehicle
      ? `${selectedVehicle.make} ${selectedVehicle.model}`
      : "Vehicle",
    rows: analysisRows,
    applicableCheckpointCount: applicableCheckpoints.length,
    unresolvedApplicabilityCount: unresolvedApplicability.length,
    safetyStatus,
    submissionEligible: eligibleForSubmission,
  });
  const searchNormalized = searchTerm.trim().toLowerCase();
  const visibleCheckpoints = useMemo(() => {
    const candidates = searchNormalized
      ? activeCheckpoints
      : currentSectionCheckpoints;
    return candidates.filter((checkpoint) => {
      if (
        searchNormalized &&
        !`${checkpoint.checkpoint_no} ${checkpoint.name}`
          .toLowerCase()
          .includes(searchNormalized.replace(/^#/, ""))
      ) {
        return false;
      }

      const key = String(checkpoint.checkpoint_no);
      const assessment = assessmentFor(session, checkpoint.checkpoint_no);
      const row = analysisRows.find(
        (candidate) => candidate.checkpoint.checkpoint_no === checkpoint.checkpoint_no
      );
      const applicable = Boolean(row);
      const notApplicable =
        checkpoint.is_conditional &&
        session.applicability[key] === false;

      switch (checkpointFilter) {
        case "pending":
          return (
            !notApplicable &&
            (!applicable || !row?.complete)
          );
        case "completed":
          return applicable && Boolean(row?.complete);
        case "failed":
          return isCheckpointFailed(checkpoint, assessment);
        case "critical":
          return (
            checkpoint.classification === "Critical" ||
            checkpoint.classification === "Mixed"
          );
        default:
          return true;
      }
    });
  }, [
    activeCheckpoints,
    analysisRows,
    checkpointFilter,
    currentSectionCheckpoints,
    searchNormalized,
    session,
  ]);
  const currentCheckpointIndex = activeCheckpoints.findIndex(
    (checkpoint) => checkpoint.checkpoint_no === currentCheckpointNo
  );

  function updateAssessment(
    checkpointNo: number,
    changes: Partial<CheckpointAssessment>
  ) {
    if (!inspection || finalizedAt) return;
    const key = String(checkpointNo);
    setSession((current) => ({
      ...current,
      assessments: {
        ...current.assessments,
        [key]: {
          ...assessmentFor(current, checkpointNo),
          ...changes,
        },
      },
    }));
    if (
      "applicabilityReason" in changes ||
      "resultStatus" in changes
    ) {
      setApplicabilityAuthorizations((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
    setDirty(true);
    setSavingMessage("");
  }

  function updateMechanic(mechanicId: string) {
    if (!inspection || finalizedAt) return;
    setSession((current) => ({ ...current, selectedMechanic: mechanicId }));
    setDirty(true);
    setSavingMessage("");
  }

  function updateApplicability(
    checkpointNo: number,
    applicable: boolean | null
  ) {
    if (!inspection || finalizedAt) return;
    const key = String(checkpointNo);
    setSession((current) => ({
      ...current,
      applicability: {
        ...current.applicability,
        [key]: applicable,
      },
      assessments: {
        ...current.assessments,
        [key]: {
          ...createEmptyAssessment(),
          resultStatus: applicable === false ? "not_applicable" : null,
        },
      },
    }));
    setApplicabilityAuthorizations((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setDirty(true);
    setSavingMessage("");
  }

  async function authorizeNotApplicable(checkpointNo: number) {
    if (
      actor.profile.role !== "admin" ||
      !inspection ||
      authorizingCheckpointNo !== null
    ) {
      return;
    }

    const key = String(checkpointNo);
    const assessment = assessmentFor(session, checkpointNo);
    if (
      session.applicability[key] !== false ||
      assessment.resultStatus !== "not_applicable" ||
      assessment.applicabilityReason.trim().length < 10
    ) {
      setSavingMessage(
        "Save a not-applicable decision with a reason of at least 10 characters before authorizing it."
      );
      return;
    }

    setAuthorizingCheckpointNo(checkpointNo);
    setSavingMessage("");
    try {
      if (!(await saveInspectionProgress())) return;
      const { error } = await supabase.rpc(
        "authorize_checkpoint_not_applicable",
        {
          p_inspection_id: inspection.id,
          p_checkpoint_no: checkpointNo,
          p_reason: assessment.applicabilityReason.trim(),
        }
      );
      if (error) {
        throw new Error(`Applicability authorization failed: ${error.message}`);
      }

      setApplicabilityAuthorizations((current) => ({
        ...current,
        [key]: {
          checkpoint_no: checkpointNo,
          reason: assessment.applicabilityReason.trim(),
          authorized_at: new Date().toISOString(),
        },
      }));
      setSavingMessage(`Checkpoint ${checkpointNo} not-applicable decision authorized.`);
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error
          ? error.message
          : "Applicability authorization failed."
      );
    } finally {
      setAuthorizingCheckpointNo(null);
    }
  }

  async function handleVehicleChange(vehicleId: string) {
    if (inspection && dirty) {
      const saved = await saveInspectionProgress();
      if (!saved) return;
    }
    setSelectedVehicleId(vehicleId);
    setActiveSectionNo(1);
    setCurrentCheckpointNo(1);
    setAnalysisGenerated(false);
    setAnalysisGeneratedAt(null);
    setLocationCapturing(false);
    setShowReport(false);
    setSavingMessage("");
  }

  function navigateToCheckpoint(checkpoint: InspectionCheckpoint) {
    setSearchTerm("");
    setCheckpointFilter("all");
    setActiveSectionNo(checkpoint.section_no);
    setCurrentCheckpointNo(checkpoint.checkpoint_no);
    window.setTimeout(() => {
      document
        .getElementById(`checkpoint-${checkpoint.checkpoint_no}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  function updateSearchTerm(value: string) {
    setSearchTerm(value);
    const query = value.trim().toLowerCase().replace(/^#/, "");
    if (!query) return;
    const firstMatch = activeCheckpoints.find((checkpoint) =>
      `${checkpoint.checkpoint_no} ${checkpoint.name}`
        .toLowerCase()
        .includes(query)
    );
    if (firstMatch) {
      setActiveSectionNo(firstMatch.section_no);
      setCurrentCheckpointNo(firstMatch.checkpoint_no);
    }
  }

  function generateAnalysis() {
    setAnalysisGenerated(true);
    setAnalysisGeneratedAt(new Date().toISOString());
  }

  async function startInspection() {
    if (
      !selectedVehicle ||
      starting ||
      (inspection !== null &&
        !["submitted", "approved", "rejected", "cancelled"].includes(
          inspection.status
        ))
    ) {
      return;
    }
    setStarting(true);
    setWorkspaceError("");
    setSavingMessage("");
    try {
      const { data, error } = await supabase
        .from("inspections")
        .insert({
          vehicle_id: selectedVehicle.id,
          inspector_id: actor.profile.id,
          status: "draft",
        })
        .select(
          "id, vehicle_id, inspector_id, status, started_at, submitted_at, completed_at, gps_lat, gps_lng, applicability, progress, selected_mechanic_id, reinspection_of"
        )
        .single();
      if (error?.code === "23505") {
        const { data: existing, error: restoreError } = await supabase
          .from("inspections")
          .select(
            "id, vehicle_id, inspector_id, status, started_at, submitted_at, completed_at, gps_lat, gps_lng, applicability, progress, selected_mechanic_id, reinspection_of"
          )
          .eq("vehicle_id", selectedVehicle.id)
          .eq("inspector_id", actor.profile.id)
          .in("status", ["draft", "in_progress"])
          .maybeSingle();
        if (restoreError) {
          throw new Error(
            `The existing inspection session could not be restored: ${restoreError.message}`
          );
        }
        if (!existing) {
          setSavingMessage(
            "This vehicle already has an open inspection owned by another active staff member."
          );
          return;
        }
        setSavingMessage("Restoring the existing open inspection session.");
        setRestoreRevision((current) => current + 1);
        return;
      }
      if (error) throw new Error(`Inspection session could not be created: ${error.message}`);
      if (!data) throw new Error("Supabase did not return the created inspection session.");

      const created = data as InspectionRecord;
      setInspection(created);
      setSession({
        ...createEmptyInspectionSession(),
        startedAt: created.started_at,
      });
      setDirty(false);
      setNow(Date.now());
      setDirty(false);
      setSavingMessage("Inspection session created in Supabase.");
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error
          ? error.message
          : "Inspection session could not be created."
      );
    } finally {
      setStarting(false);
    }
  }

  async function saveInspectionProgress(): Promise<boolean> {
    if (!inspection || !selectedVehicle || saving || finalizedAt) return false;
    setSaving(true);
    setWorkspaceError("");
    setSavingMessage("");

    try {
      const savedAt = new Date().toISOString();
      const { data: existingResults, error: existingResultsError } =
        await supabase
          .from("checkpoint_results")
          .select("id, checkpoint_no")
          .eq("inspection_id", inspection.id);
      if (existingResultsError) {
        throw new Error(
          `Existing checkpoint results could not be loaded before save: ${existingResultsError.message}`
        );
      }
      const existingResultIdByCheckpoint = new Map(
        (existingResults ?? []).map((result) => [
          result.checkpoint_no,
          result.id,
        ])
      );
      const checkpointPayload = activeCheckpoints.map((checkpoint) => {
        const key = String(checkpoint.checkpoint_no);
        const assessment = assessmentFor(session, checkpoint.checkpoint_no);
        const applicability = checkpoint.is_conditional
          ? session.applicability[key]
          : true;
        const notApplicable =
          checkpoint.is_conditional && applicability === false;
        const autoValue = getAutoValue(
          checkpoint,
          selectedVehicle,
          session,
          currentGps,
          now,
          mechanics
        );
        const assessmentStarted = isAssessmentStarted(
          checkpoint,
          assessment,
          applicability,
          autoValue
        );
        const measuredNumber = Number(assessment.measuredValue);

        return {
          ...(existingResultIdByCheckpoint.has(checkpoint.checkpoint_no)
            ? {
                id: existingResultIdByCheckpoint.get(
                  checkpoint.checkpoint_no
                ),
              }
            : {}),
          inspection_id: inspection.id,
          checkpoint_no: checkpoint.checkpoint_no,
          applicable: applicability,
          result_status: notApplicable
            ? "not_applicable"
            : assessment.resultStatus,
          cosmetic_score: assessment.cosmeticScore,
          measured_value:
            assessment.measuredValue.trim() !== "" &&
            Number.isFinite(measuredNumber)
              ? measuredNumber
              : null,
          measured_value_input: assessment.measuredValue || null,
          measured_unit: assessment.measuredUnit || null,
          expected_value: assessment.expectedValue || null,
          recorded_value: checkpoint.assessment_method.startsWith("Auto-")
            ? null
            : assessment.recordedValue || null,
          auto_value: checkpoint.assessment_method.startsWith("Auto-")
            ? autoValue || null
            : null,
          match_status: assessment.matchStatus,
          issue_description: assessment.issueDescription || null,
          observation: assessment.observation || null,
          applicability_reason: assessment.applicabilityReason || null,
          count_value: assessment.countValue || null,
          is_disclosed: assessment.isDisclosed,
          evidence_due: assessment.evidenceDue,
          assessed_by: actor.profile.id,
          assessed_at: assessmentStarted ? savedAt : null,
        };
      });

      const { data: resultRows, error: resultError } = await supabase
        .from("checkpoint_results")
        .upsert(checkpointPayload, {
          onConflict: "inspection_id,checkpoint_no",
        })
        .select("id, checkpoint_no");
      if (resultError) {
        throw new Error(`Checkpoint results could not be saved: ${resultError.message}`);
      }

      const resultIdByCheckpoint = new Map(
        (resultRows ?? []).map((row) => [row.checkpoint_no, row.id])
      );
      if (resultIdByCheckpoint.size !== activeCheckpoints.length) {
        throw new Error(
          `Supabase confirmed ${resultIdByCheckpoint.size} of ${activeCheckpoints.length} checkpoint results. Retry the save.`
        );
      }

      const evidenceAfterUpload: Record<string, LocalEvidence[]> = {
        ...currentEvidence,
      };
      for (const [checkpointKey, checkpointEvidence] of Object.entries(
        currentEvidence
      )) {
        const checkpointNo = Number(checkpointKey);
        const resultId = resultIdByCheckpoint.get(checkpointNo);
        if (!resultId) {
          throw new Error(`Checkpoint ${checkpointNo} has no saved result for evidence.`);
        }

        for (const item of checkpointEvidence) {
          if (!item.file) continue;
          const extension =
            item.name
              .split(".")
              .pop()
              ?.replace(/[^a-zA-Z0-9]/g, "")
              .slice(0, 8) ||
            (item.mediaType === "photo" ? "jpg" : "mp4");
          const storagePath = `${inspection.id}/${checkpointNo}/${item.id}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("inspection-evidence")
            .upload(storagePath, item.file, {
              contentType: item.file.type,
              upsert: true,
            });
          if (uploadError) {
            throw new Error(`Evidence upload failed for checkpoint ${checkpointNo}: ${uploadError.message}`);
          }

          const evidencePayload = {
            checkpoint_result_id: resultId,
            media_type: item.mediaType,
            storage_path: storagePath,
            uploaded_by: actor.profile.id,
            metadata: { original_filename: item.name },
          };
          const { data: existingEvidence, error: existingEvidenceError } =
            await supabase
              .from("evidence")
              .select("id, checkpoint_result_id, media_type")
              .eq("storage_path", storagePath)
              .maybeSingle();
          if (existingEvidenceError) {
            throw new Error(
              `Existing evidence could not be checked for checkpoint ${checkpointNo}: ${existingEvidenceError.message}`
            );
          }

          let evidenceRowId = existingEvidence?.id;
          if (existingEvidence) {
            if (
              existingEvidence.checkpoint_result_id !== resultId ||
              existingEvidence.media_type !== item.mediaType
            ) {
              throw new Error(
                `Evidence path collision detected for checkpoint ${checkpointNo}.`
              );
            }
          } else {
            const { data: insertedEvidence, error: evidenceInsertError } =
              await supabase
                .from("evidence")
                .insert(evidencePayload)
                .select("id")
                .single();
            if (evidenceInsertError?.code === "23505") {
              const { data: racedEvidence, error: racedEvidenceError } =
                await supabase
                  .from("evidence")
                  .select("id, checkpoint_result_id, media_type")
                  .eq("storage_path", storagePath)
                  .maybeSingle();
              if (racedEvidenceError) {
                throw new Error(
                  `Evidence retry could not be verified for checkpoint ${checkpointNo}: ${racedEvidenceError.message}`
                );
              }
              if (
                !racedEvidence ||
                racedEvidence.checkpoint_result_id !== resultId ||
                racedEvidence.media_type !== item.mediaType
              ) {
                throw new Error(
                  `Evidence record could not be safely reconciled for checkpoint ${checkpointNo}.`
                );
              }
              evidenceRowId = racedEvidence.id;
            } else if (evidenceInsertError) {
              throw new Error(
                `Evidence record could not be saved for checkpoint ${checkpointNo}: ${evidenceInsertError.message}`
              );
            } else {
              evidenceRowId = insertedEvidence.id;
            }
          }

          const savedItem: LocalEvidence = {
            ...item,
            databaseId: evidenceRowId,
            storagePath,
            file: undefined,
          };
          evidenceAfterUpload[checkpointKey] = (
            evidenceAfterUpload[checkpointKey] ?? []
          ).map((candidate) =>
            candidate.id === item.id ? savedItem : candidate
          );
        }
      }

      const completedAfterSave = applicableCheckpoints.filter((checkpoint) =>
        isCheckpointComplete(
          checkpoint,
          session,
          selectedVehicle,
          currentGps,
          now,
          evidenceAfterUpload[String(checkpoint.checkpoint_no)] ?? [],
          mechanics,
          Boolean(applicabilityAuthorizations[String(checkpoint.checkpoint_no)])
        )
      ).length;
      const evidenceMissingAfterSave = applicableCheckpoints.filter(
        (checkpoint) => {
          const key = String(checkpoint.checkpoint_no);
          const assessment = assessmentFor(session, checkpoint.checkpoint_no);
          const autoValue = getAutoValue(
            checkpoint,
            selectedVehicle,
            session,
            currentGps,
            now,
            mechanics
          );
          const started = isAssessmentStarted(
            checkpoint,
            assessment,
            session.applicability[key],
            autoValue
          );
          const due =
            checkpoint.evidence_required !== "Not required" &&
            (started || assessment.evidenceDue);
          return (
            due &&
            !hasRequiredEvidence(
              checkpoint.evidence_required,
              evidenceAfterUpload[key] ?? []
            )
          );
        }
      ).length;
      const progress = {
        applicable: applicableCheckpoints.length,
        completed: completedAfterSave,
        pending: Math.max(0, applicableCheckpoints.length - completedAfterSave),
        unresolved_applicability: unresolvedApplicability.length,
        evidence_missing: evidenceMissingAfterSave,
      };

      const { data: savedInspection, error: inspectionSaveError } =
        await supabase
          .from("inspections")
          .update({
            status: "in_progress",
            applicability: session.applicability,
            progress,
            gps_lat: currentGps?.latitude ?? null,
            gps_lng: currentGps?.longitude ?? null,
            selected_mechanic_id: session.selectedMechanic || null,
          })
          .eq("id", inspection.id)
          .select(
            "id, vehicle_id, inspector_id, status, started_at, submitted_at, completed_at, gps_lat, gps_lng, applicability, progress, selected_mechanic_id, reinspection_of"
          )
          .single();
      if (inspectionSaveError) {
        throw new Error(`Inspection progress could not be saved: ${inspectionSaveError.message}`);
      }
      if (!savedInspection) {
        throw new Error("Supabase did not confirm the inspection progress update.");
      }

      setEvidenceByInspection((current) => ({
        ...current,
        [inspection.id]: evidenceAfterUpload,
      }));
      setInspection(savedInspection as InspectionRecord);
      setDirty(false);
      setSavingMessage("Inspection progress and attached evidence were saved to Supabase.");
      return true;
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error
          ? `Save incomplete: ${error.message} Earlier successful writes are retained; retry is safe.`
          : "Save incomplete. Earlier successful writes are retained; retry is safe."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function openWorkshopWorkflow() {
    if (dirty && !(await saveInspectionProgress())) return;
    onOpenWorkshopWorkflow();
  }

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setLocationMessage("This browser does not support GPS capture.");
      return;
    }

    setLocationCapturing(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentGps({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setDirty(true);
        setLocationMessage("GPS captured. Save progress to store it with this inspection.");
        setLocationCapturing(false);
      },
      (error) => {
        setLocationMessage(`GPS was not captured: ${error.message}`);
        setLocationCapturing(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function addEvidence(
    checkpointNo: number,
    mediaType: "photo" | "video",
    files: FileList | null
  ) {
    if (!inspection || !files || files.length === 0) return;
    const acceptedFiles = Array.from(files).filter((file) =>
      file.type.startsWith(mediaType === "photo" ? "image/" : "video/")
    );
    const rejectedCount = files.length - acceptedFiles.length;
    const additions = acceptedFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.add(previewUrl);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mediaType,
        previewUrl,
        file,
      } satisfies LocalEvidence;
    });

    if (rejectedCount > 0) {
      setSavingMessage(
        `${rejectedCount} file(s) were not added because their media type did not match the evidence field.`
      );
    } else {
      setSavingMessage("");
    }

    const key = String(checkpointNo);
    setEvidenceByInspection((current) => {
      const inspectionEvidence = current[inspection.id] ?? {};
      return {
        ...current,
        [inspection.id]: {
          ...inspectionEvidence,
          [key]: [...(inspectionEvidence[key] ?? []), ...additions],
        },
      };
    });
    if (additions.length > 0) setDirty(true);
  }

  async function removeEvidence(checkpointNo: number, evidenceId: string) {
    if (!inspection || saving || finalizedAt) return;
    const key = String(checkpointNo);
    const item = (currentEvidence[key] ?? []).find(
      (evidence) => evidence.id === evidenceId
    );
    if (!item) return;

    setSavingMessage("");
    try {
      if (item.storagePath) {
        const { error: storageError } = await supabase.storage
          .from("inspection-evidence")
          .remove([item.storagePath]);
        if (storageError) {
          throw new Error(`Uploaded evidence could not be removed: ${storageError.message}`);
        }
      }
      if (item.databaseId) {
        const { error: recordError } = await supabase
          .from("evidence")
          .delete()
          .eq("id", item.databaseId);
        if (recordError) {
          throw new Error(`Evidence record could not be removed: ${recordError.message}`);
        }
      }
      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
        objectUrls.current.delete(item.previewUrl);
      }
      setEvidenceByInspection((current) => {
        const forInspection = current[inspection.id] ?? {};
        return {
          ...current,
          [inspection.id]: {
            ...forInspection,
            [key]: (forInspection[key] ?? []).filter(
              (evidence) => evidence.id !== evidenceId
            ),
          },
        };
      });
      setDirty(true);
      setSavingMessage("Evidence removed from this inspection.");
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error
          ? `Evidence removal failed: ${error.message}`
          : "Evidence removal failed."
      );
    }
  }

  async function finalizeInspection() {
    if (!eligibleForSubmission || !inspection || submitting || finalizedAt) return;
    setSubmitting(true);
    setSavingMessage("");
    try {
      const { data, error } = await supabase.rpc("submit_inspection", {
        p_inspection_id: inspection.id,
      });
      if (error) {
        throw new Error(`Inspection submission was rejected: ${error.message}`);
      }
      if (
        !data ||
        typeof data !== "object" ||
        !("inspection_id" in data) ||
        data.inspection_id !== inspection.id ||
        (data.status !== "submitted" &&
          data.status !== "repair_required") ||
        typeof data.completed_at !== "string"
      ) {
        throw new Error("Supabase did not return a confirmed submission summary.");
      }

      const { data: rating, error: ratingError } = await supabase
        .from("vehicle_ratings")
        .select("cosmetic_score, critical_failures, safety_clearance, sale_ready")
        .eq("inspection_id", inspection.id)
        .single();
      if (ratingError) {
        throw new Error(`Submitted rating could not be verified: ${ratingError.message}`);
      }
      if (!rating) {
        throw new Error("Supabase did not persist a vehicle rating for the submission.");
      }

      const submittedAt = data.completed_at;
      const status = data.status;
      setVehicleRating(rating as VehicleRatingRecord);
      setInspection((current) =>
        current
          ? {
              ...current,
              status,
              submitted_at: submittedAt,
              completed_at: submittedAt,
              progress: {
                applicable: applicableCheckpoints.length,
                completed: applicableCheckpoints.length,
                pending: 0,
              },
            }
          : current
      );
      setNow(Date.now());
      setSavingMessage(
        status === "repair_required"
          ? "Inspection submitted to Supabase. Critical failures remain blocked; sale readiness is not granted."
          : "Inspection submitted to Supabase. Safety clearance is recorded; sale readiness still requires quality control."
      );
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error
          ? error.message
          : "Inspection submission could not be confirmed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function reloadRepairJobs() {
    if (!inspection) return;
    const repairInspectionId =
      inspection.status === "repair_required"
        ? inspection.id
        : inspection.reinspection_of ?? inspection.id;
    const { data, error } = await supabase
      .from("repair_jobs")
      .select(
        "id, inspection_id, title, description, priority, status, assigned_mechanic_id"
      )
      .eq("inspection_id", repairInspectionId)
      .order("created_at");
    if (error) {
      throw new Error(`Repair workflow could not be refreshed: ${error.message}`);
    }
    setRepairJobs((data ?? []) as RepairJobRecord[]);
  }

  async function assignRepairJob(jobId: string, mechanicId: string) {
    if (!mechanicId || workflowBusy) return;
    setWorkflowBusy(jobId);
    setSavingMessage("");
    try {
      const { error } = await supabase.rpc("assign_repair_job", {
        p_repair_job_id: jobId,
        p_mechanic_id: mechanicId,
      });
      if (error) throw new Error(`Repair assignment failed: ${error.message}`);
      await reloadRepairJobs();
      setSavingMessage("Repair assignment was saved to Supabase.");
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error ? error.message : "Repair assignment failed."
      );
    } finally {
      setWorkflowBusy("");
    }
  }

  async function completeRepairJob(jobId: string) {
    const note = workflowNotes[jobId]?.trim() ?? "";
    if (!note || workflowBusy) return;
    setWorkflowBusy(jobId);
    setSavingMessage("");
    try {
      const { error } = await supabase.rpc("complete_repair_job", {
        p_repair_job_id: jobId,
        p_note: note,
      });
      if (error) throw new Error(`Repair completion failed: ${error.message}`);
      await reloadRepairJobs();
      setSavingMessage("Repair completion was recorded for quality verification.");
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error ? error.message : "Repair completion failed."
      );
    } finally {
      setWorkflowBusy("");
    }
  }

  async function verifyRepairJob(jobId: string, approved: boolean) {
    const note = workflowNotes[jobId]?.trim() ?? "";
    if (note.length < 5 || workflowBusy) return;
    setWorkflowBusy(jobId);
    setSavingMessage("");
    try {
      const { error } = await supabase.rpc("verify_repair_job", {
        p_repair_job_id: jobId,
        p_approved: approved,
        p_notes: note,
      });
      if (error) throw new Error(`Repair verification failed: ${error.message}`);
      await reloadRepairJobs();
      setSavingMessage(
        approved
          ? "Repair verification was recorded."
          : "Repair verification was rejected and returned to the mechanic."
      );
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error ? error.message : "Repair verification failed."
      );
    } finally {
      setWorkflowBusy("");
    }
  }

  async function startReinspection() {
    if (!inspection || workflowBusy) return;
    setWorkflowBusy("reinspection");
    setSavingMessage("");
    try {
      const { data, error } = await supabase.rpc("start_reinspection", {
        p_inspection_id: inspection.id,
      });
      if (error) throw new Error(`Reinspection could not be started: ${error.message}`);
      if (typeof data !== "string") {
        throw new Error("Supabase did not return the reinspection session ID.");
      }
      setSavingMessage("Reinspection session created. Restoring it from Supabase.");
      setRestoreRevision((current) => current + 1);
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error
          ? error.message
          : "Reinspection could not be started."
      );
    } finally {
      setWorkflowBusy("");
    }
  }

  async function finalizeQualityReview(approved: boolean) {
    if (!inspection || workflowBusy) return;
    const note = workflowNotes.quality?.trim() ?? "";
    if (note.length < 5) return;
    setWorkflowBusy("quality");
    setSavingMessage("");
    try {
      const { error } = await supabase.rpc("finalize_quality_review", {
        p_inspection_id: inspection.id,
        p_approved: approved,
        p_notes: note,
      });
      if (error) throw new Error(`Quality review failed: ${error.message}`);
      setSavingMessage(
        approved
          ? "Quality approval was recorded. Sale readiness is verified from Supabase."
          : "Quality review rejection was recorded in Supabase."
      );
      setRestoreRevision((current) => current + 1);
    } catch (error: unknown) {
      setSavingMessage(
        error instanceof Error ? error.message : "Quality review failed."
      );
    } finally {
      setWorkflowBusy("");
    }
  }

  function sectionStatus(sectionNo: number) {
    const vehicleSectionCheckpoints = activeCheckpoints.filter(
      (checkpoint) => checkpoint.section_no === sectionNo
    );
    if (vehicleSectionCheckpoints.length === 0) return null;
    const sectionCheckpoints = applicableCheckpoints.filter(
      (checkpoint) => checkpoint.section_no === sectionNo
    );
    const unresolved = unresolvedApplicability.filter(
      (checkpoint) => checkpoint.section_no === sectionNo
    ).length;
    const complete = sectionCheckpoints.filter(
      (checkpoint) => progressByCheckpoint.get(checkpoint.checkpoint_no)
    ).length;
    return {
      complete,
      total: sectionCheckpoints.length,
      unresolved,
      notApplicable: sectionCheckpoints.length === 0 && unresolved === 0,
      percentage:
        sectionCheckpoints.length === 0
          ? 0
          : Math.round((complete / sectionCheckpoints.length) * 100),
    };
  }

  if (workspaceLoading) {
    return (
      <DemoModulePage
        title="260-point Vehicle Inspection"
        description="Loading authenticated workshop vehicles and staff."
        icon={ClipboardCheck}
        modeLabel="LIVE WORKFLOW"
      >
        <DemoPanel title="Loading workshop data">
          <div className="flex items-center gap-3 py-6 text-sm text-[#697267]" role="status">
            <Loader2 size={18} className="animate-spin text-[#315D40]" />
            Loading vehicles, inspectors, mechanics and saved sessions from Supabase…
          </div>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  if (workspaceError) {
    return (
      <DemoModulePage
        title="260-point Vehicle Inspection"
        description="Workshop data could not be loaded or restored. No demo records are substituted."
        icon={ClipboardCheck}
        modeLabel="LIVE WORKFLOW"
      >
        <DemoPanel title="Workshop data unavailable">
          <div
            className="rounded-xl border border-[#EBC4BA] bg-[#FCE9E5] p-4 text-sm text-[#9F4A3A]"
            role="alert"
          >
            {workspaceError}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${demoButtonClass} mt-4`}
          >
            Reload workshop data
          </button>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  if (vehicles.length === 0) {
    return (
      <DemoModulePage
        title="260-point Vehicle Inspection"
        description="Register a real vehicle before starting its inspection."
        icon={ClipboardCheck}
        modeLabel="LIVE WORKFLOW"
        notice={`Signed in as ${actor.profile.full_name}. Only authenticated staff can register vehicles.`}
      >
        <DemoPanel title="No registered vehicles">
          <p className="text-sm leading-6 text-[#697267]">
            No vehicles were returned from Supabase. Register a vehicle to continue.
          </p>
          <Link href="/vehicles" className={`${demoButtonClass} mt-4`}>
            Open Vehicle Management
          </Link>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  if (!selectedVehicle) return null;

  if (restoring) {
    return (
      <DemoModulePage
        title="260-point Vehicle Inspection"
        description="Restoring the selected vehicle’s open inspection from Supabase."
        icon={ClipboardCheck}
        modeLabel="LIVE WORKFLOW"
      >
        <DemoPanel title="Restoring saved inspection">
          <div className="flex items-center gap-3 py-6 text-sm text-[#697267]" role="status">
            <Loader2 size={18} className="animate-spin text-[#315D40]" />
            Loading checkpoint results and private evidence…
          </div>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  const workflowVisible =
    inspection !== null &&
    !["draft", "in_progress", "cancelled"].includes(inspection.status);
  const allRepairsVerified =
    repairJobs.length > 0 &&
    repairJobs.every((job) => job.status === "verified");
  const canReviewQuality =
    actor.profile.role === "admin" ||
    actor.profile.role === "quality_controller";
  const canStartInspection =
    inspection === null ||
    ["submitted", "approved", "rejected", "cancelled"].includes(
      inspection.status
    );

  return (
    <DemoModulePage
      title="260-point Vehicle Inspection"
      description="Assess every applicable checkpoint. Confirmed results and private evidence are saved to Supabase."
      icon={ClipboardCheck}
      modeLabel="LIVE WORKFLOW"
      notice={`${actor.profile.full_name} · ${actor.profile.role}. Changes are shown as saved only after Supabase confirms them.`}
    >
      {(actor.profile.role === "mechanic" ||
        actor.profile.role === "quality_controller") && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E8E3D8] bg-white p-2">
          <span className="px-2 text-xs font-bold text-[#315D40]">
            Vehicle inspection
          </span>
          <button
            type="button"
            onClick={() => void openWorkshopWorkflow()}
            disabled={saving || submitting || restoring}
            className={demoSubtleButtonClass}
          >
            {actor.profile.role === "mechanic"
              ? "Assigned repair work"
              : "Quality control"}
          </button>
        </div>
      )}
      <DemoPanel
        title="Vehicle and inspection session"
        description="Vehicles and open inspection sessions are loaded from Supabase. New sessions are linked to the signed-in staff member."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-[#697267]">
              Registered vehicle
            </span>
            <select
              value={selectedVehicleId}
              onChange={(event) => handleVehicleChange(event.target.value)}
              disabled={saving || starting || restoring}
              className="w-full rounded-xl border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-3 text-sm text-[#344337] outline-none focus:border-[#63866B]"
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.make} {vehicle.model} · {vehicle.registration_number} ·{" "}
                  {vehicle.vehicle_type}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-[10px] text-[#92958A]">
              {selectedVehicle.id} · Supabase vehicle record
            </span>
          </label>

          <button
            type="button"
            onClick={startInspection}
            disabled={!canStartInspection || starting || restoring}
            className={demoButtonClass}
          >
            {starting ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Creating session…
              </>
            ) : inspection && !canStartInspection ? (
              <>
                <CheckCircle2 size={15} /> Session {inspection.status.replace("_", " ")}
              </>
            ) : (
              <>
                <ClipboardCheck size={15} /> Start inspection
              </>
            )}
          </button>

          <button
            type="button"
            onClick={saveInspectionProgress}
            disabled={
              !inspection ||
              restoring ||
              saving ||
              submitting ||
              Boolean(finalizedAt)
            }
            className={demoSubtleButtonClass}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}{" "}
            Save progress
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EEE7] pt-4">
          <div className="flex items-center gap-2 text-xs">
            <Bike size={15} className="text-[#315D40]" />
            <span className="font-semibold text-[#344337]">
              {selectedVehicle.make} {selectedVehicle.model}
              {selectedVehicle.variant ? ` · ${selectedVehicle.variant}` : ""}
            </span>
            <span className="text-[#92958A]">
              {selectedVehicle.registration_number}
            </span>
          </div>
          <p className="text-[10px] text-[#92958A]">
            {inspection
              ? `Staff member: ${actor.profile.full_name} · ${inspection.id}`
              : "No inspection session exists until you start one."}
          </p>
        </div>
        {dirty && (
          <p className="mt-3 rounded-lg bg-[#FFF6E9] px-3 py-2 text-[10px] text-[#80643A]">
            Unsaved changes. Save progress before leaving this vehicle; switching vehicles saves automatically.
          </p>
        )}
        {savingMessage && (
          <p
            role="status"
            className="mt-3 rounded-lg bg-[#F3F4ED] px-3 py-2 text-[10px] leading-5 text-[#526052]"
          >
            {savingMessage}
          </p>
        )}
      </DemoPanel>

      {workflowVisible && (
        <DemoPanel
          title="Repair and quality-control workflow"
          description="Submitted inspections and checkpoint results are immutable. Repairs, verification, reinspection and sale approval are recorded as separate authorized workflow steps."
        >
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px]">
            <span className="rounded-full bg-[#F3F0E7] px-3 py-1.5 font-bold capitalize text-[#697267]">
              Inspection status: {inspection?.status.replaceAll("_", " ")}
            </span>
            <span
              className={`rounded-full px-3 py-1.5 font-bold ${
                vehicleRating?.sale_ready
                  ? "bg-[#E7F4E6] text-[#26804B]"
                  : "bg-[#FFF6E9] text-[#80643A]"
              }`}
            >
              Sale ready: {vehicleRating?.sale_ready ? "Yes" : "No"}
            </span>
          </div>

          {repairJobs.length > 0 ? (
            <div className="space-y-3">
              {repairJobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-xl border border-[#E8E3D8] bg-[#FCFBF7] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#344337]">
                        {job.title}
                      </h3>
                      {job.description && (
                        <p className="mt-1 text-xs leading-5 text-[#697267]">
                          {job.description}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-[#F3F0E7] px-3 py-1.5 text-[10px] font-bold capitalize text-[#697267]">
                      {job.priority} · {job.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  {inspection?.status === "repair_required" &&
                    actor.profile.role === "admin" &&
                    job.status !== "verified" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <select
                          value={job.assigned_mechanic_id ?? ""}
                          onChange={(event) =>
                            void assignRepairJob(job.id, event.target.value)
                          }
                          disabled={workflowBusy === job.id}
                          aria-label={`Assign mechanic for ${job.title}`}
                          className="min-w-[220px] flex-1 rounded-xl border border-[#E8E3D8] bg-white px-3 py-2.5 text-xs text-[#344337]"
                        >
                          <option value="">Select an active mechanic</option>
                          {mechanics.map((mechanic) => (
                            <option key={mechanic.id} value={mechanic.id}>
                              {mechanic.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                  {inspection?.status === "repair_required" &&
                    actor.profile.role === "mechanic" &&
                    job.assigned_mechanic_id === actor.profile.id &&
                    ["assigned", "in_progress"].includes(job.status) && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={workflowNotes[job.id] ?? ""}
                          onChange={(event) =>
                            setWorkflowNotes((current) => ({
                              ...current,
                              [job.id]: event.target.value,
                            }))
                          }
                          rows={2}
                          maxLength={2000}
                          placeholder="Record the work performed"
                          className="w-full rounded-xl border border-[#E8E3D8] bg-white px-3 py-2.5 text-xs text-[#344337]"
                        />
                        <button
                          type="button"
                          onClick={() => void completeRepairJob(job.id)}
                          disabled={
                            workflowBusy === job.id ||
                            (workflowNotes[job.id]?.trim().length ?? 0) < 10
                          }
                          className={demoSubtleButtonClass}
                        >
                          {workflowBusy === job.id ? "Saving…" : "Submit repair for QC"}
                        </button>
                      </div>
                    )}

                  {inspection?.status === "repair_required" &&
                    canReviewQuality &&
                    job.status === "completed" && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={workflowNotes[job.id] ?? ""}
                          onChange={(event) =>
                            setWorkflowNotes((current) => ({
                              ...current,
                              [job.id]: event.target.value,
                            }))
                          }
                          rows={2}
                          maxLength={2000}
                          placeholder="Record the repair verification outcome"
                          className="w-full rounded-xl border border-[#E8E3D8] bg-white px-3 py-2.5 text-xs text-[#344337]"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void verifyRepairJob(job.id, true)}
                            disabled={
                              workflowBusy === job.id ||
                              (workflowNotes[job.id]?.trim().length ?? 0) < 5
                            }
                            className={demoButtonClass}
                          >
                            Verify repair
                          </button>
                          <button
                            type="button"
                            onClick={() => void verifyRepairJob(job.id, false)}
                            disabled={
                              workflowBusy === job.id ||
                              (workflowNotes[job.id]?.trim().length ?? 0) < 5
                            }
                            className={demoSubtleButtonClass}
                          >
                            Reject repair
                          </button>
                        </div>
                      </div>
                    )}
                </article>
              ))}
            </div>
          ) : inspection?.status === "repair_required" ? (
            <p className="rounded-xl bg-[#FFF6E9] p-3 text-xs leading-5 text-[#80643A]">
              Repair jobs have not been returned. Reinspection remains blocked until server-side repair verification is complete.
            </p>
          ) : null}

          {inspection?.status === "repair_required" &&
            (actor.profile.role === "admin" ||
              inspection.inspector_id === actor.user.id) && (
              <button
                type="button"
                onClick={() => void startReinspection()}
                disabled={!allRepairsVerified || workflowBusy === "reinspection"}
                className={`${demoButtonClass} mt-4`}
              >
                {workflowBusy === "reinspection"
                  ? "Starting reinspection…"
                  : "Start linked reinspection"}
              </button>
            )}
            
          {(inspection?.status === "submitted" ||
            inspection?.status === "qc_pending") &&
            canReviewQuality && (
              <div className="mt-4 space-y-3 rounded-xl border border-[#E8E3D8] bg-[#FCFBF7] p-4">
                <div>
                  <h3 className="text-sm font-bold text-[#344337]">
                    Final quality review
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#697267]">
                    Approval is rejected by the database if safety clearance is not cleared, any critical failure remains, or a linked repair cycle is not verified.
                  </p>
                </div>
                <textarea
                  value={workflowNotes.quality ?? ""}
                  onChange={(event) =>
                    setWorkflowNotes((current) => ({
                      ...current,
                      quality: event.target.value,
                    }))
                  }
                  rows={2}
                  maxLength={2000}
                  placeholder="Record the final QC decision and rationale"
                  className="w-full rounded-xl border border-[#E8E3D8] bg-white px-3 py-2.5 text-xs text-[#344337]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void finalizeQualityReview(true)}
                    disabled={
                      workflowBusy === "quality" ||
                      (workflowNotes.quality?.trim().length ?? 0) < 5
                    }
                    className={demoButtonClass}
                  >
                    {workflowBusy === "quality" ? "Saving…" : "Approve and mark sale ready"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void finalizeQualityReview(false)}
                    disabled={
                      workflowBusy === "quality" ||
                      (workflowNotes.quality?.trim().length ?? 0) < 5
                    }
                    className={demoSubtleButtonClass}
                  >
                    Reject quality review
                  </button>
                </div>
              </div>
            )}
        </DemoPanel>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DemoMetricCard
          label="Completed checkpoints"
          value={`${completedCount} / ${applicableCheckpoints.length}`}
          detail={`${overallProgress}% of resolved applicable checks`}
          icon={CheckCircle2}
        />
        <DemoMetricCard
          label="Pending checkpoints"
          value={pendingCount}
          detail="Applicable checks not fully complete"
          icon={ClipboardCheck}
          accent="amber"
        />
        <DemoMetricCard
          label="Failed critical checks"
          value={failedCritical.length}
          detail="Critical failures block safety clearance"
          icon={ShieldAlert}
          accent="orange"
        />
        <DemoMetricCard
          label="Evidence missing"
          value={evidenceMissingCount}
          detail="Required and currently due"
          icon={FileCheck2}
          accent="amber"
        />
        <DemoMetricCard
          label="Applicability to confirm"
          value={unresolvedApplicability.length}
          detail="Conditional equipment checks"
          icon={ShieldCheck}
          accent="orange"
        />
      </section>

      <DemoPanel
        title="Inspection completion"
        description={`The master contains 260 checkpoints. ${applicableCheckpoints.length} are currently applicable to this ${selectedVehicle.vehicle_type}. Vehicle-specific checks are filtered; unresolved equipment checks stay outside the progress denominator until applicability is confirmed.`}
      >
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-[#475448]">
            Completed / applicable checkpoints
          </span>
          <span className="font-bold text-[#28543D]">
            {completedCount} / {applicableCheckpoints.length} · {overallProgress}%
          </span>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-[#F0EEE7]"
          role="progressbar"
          aria-label="Overall inspection completion"
          aria-valuenow={overallProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[#398653] transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px]">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold ${
              safetyStatus === "Blocked"
                ? "bg-[#FCE9E5] text-[#B44936]"
                : safetyStatus === "Cleared"
                  ? "bg-[#E7F4E6] text-[#26804B]"
                  : "bg-[#F3F0E7] text-[#777D71]"
            }`}
          >
            {safetyStatus === "Blocked" ? (
              <ShieldAlert size={13} />
            ) : (
              <ShieldCheck size={13} />
            )}
            Safety clearance: {safetyStatus}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 font-bold ${
              saleReady
                ? "bg-[#E7F4E6] text-[#26804B]"
                : "bg-[#F3F0E7] text-[#777D71]"
            }`}
          >
            Sale Ready: {saleReady ? "Yes" : "No"}
          </span>
          {averageCosmeticScore !== null && (
            <span className="rounded-full bg-[#FFF3E4] px-3 py-1.5 font-bold text-[#9A7026]">
              Cosmetic score: {averageCosmeticScore.toFixed(1)} / 5
            </span>
          )}
          <span className="text-[#92958A]">
            Cosmetic scores never override critical safety failures.
          </span>
        </div>
        {unresolvedApplicability.length > 0 && (
          <p className="mt-3 rounded-lg bg-[#FFF6E9] px-3 py-2 text-[10px] text-[#80643A]">
            {unresolvedApplicability.length} conditional checkpoint(s) need an equipment/applicability decision. They are excluded from the percentage denominator but prevent submission until resolved.
          </p>
        )}
      </DemoPanel>

      <DemoPanel
        title="Section-by-section checklist"
        description="Section progress is calculated only from checkpoints applicable to the selected vehicle. The original source section labels are retained."
      >
        <nav
          aria-label="Inspection checklist sections"
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          {inspectionChecklist.sections.map((section) => {
            const progress = sectionStatus(section.section_no);
            const isCurrent = activeSectionNo === section.section_no;
            return (
              <button
                key={section.section_no}
                type="button"
                onClick={() => {
                  setActiveSectionNo(section.section_no);
                  const first = activeCheckpoints.find(
                    (checkpoint) => checkpoint.section_no === section.section_no
                  );
                  if (first) setCurrentCheckpointNo(first.checkpoint_no);
                }}
                disabled={!progress}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex min-h-[58px] items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                  isCurrent
                    ? "border-[#244A36] bg-[#244A36] text-white"
                    : progress
                      ? "border-[#E8E3D8] bg-[#FCFBF7] text-[#344337] hover:border-[#94A894]"
                      : "cursor-not-allowed border-[#F0EEE7] bg-[#F7F6F1] text-[#B1B1A6]"
                }`}
                title={
                  progress
                    ? progress.total > 0
                      ? `${progress.complete} of ${progress.total} applicable checkpoints complete`
                      : progress.unresolved > 0
                        ? `${progress.unresolved} applicability decisions needed`
                        : "Conditional checkpoints are not applicable"
                    : "Not applicable for this vehicle type"
                }
              >
                <span className="min-w-0">
                  <span className="block text-[9px] font-extrabold tracking-wide opacity-75">
                    SECTION {sourceSectionLabels[section.section_no]}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold">
                    {section.name}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-bold">
                  {!progress
                    ? "—"
                    : progress.total > 0
                      ? `${progress.percentage}%`
                      : progress.unresolved > 0
                        ? "Decide"
                        : "N/A"}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-[#F0EEE7] pt-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[1.5px] text-[#A27649]">
                {searchNormalized
                  ? "SEARCH RESULTS"
                  : `SECTION ${sourceSectionLabels[activeSectionNo]}`}
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#244A36]">
                {searchNormalized
                  ? `${visibleCheckpoints.length} matching checkpoint(s)`
                  : currentSection?.name}
              </h2>
            </div>
            <p className="text-[10px] text-[#92958A]">
              {searchNormalized
                ? "Search spans all vehicle-active checkpoints."
                : sectionStatus(activeSectionNo)?.total
                ? `${sectionStatus(activeSectionNo)?.complete ?? 0} / ${sectionStatus(activeSectionNo)?.total} applicable complete`
                : (sectionStatus(activeSectionNo)?.unresolved ?? 0) > 0
                  ? `${sectionStatus(activeSectionNo)?.unresolved} applicability decisions needed`
                  : "No applicable checks in this section"}
            </p>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#92958A]"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => updateSearchTerm(event.target.value)}
                placeholder="Search all applicable checkpoint names or numbers"
                aria-label="Search checkpoints"
                className="w-full rounded-xl border border-[#E8E3D8] bg-[#FAF9F5] py-2.5 pl-9 pr-3 text-xs text-[#344337] outline-none focus:border-[#63866B]"
              />
            </label>
            <label className="flex items-center gap-2 text-[10px] font-semibold text-[#697267]">
              Filter
              <select
                value={checkpointFilter}
                onChange={(event) =>
                  setCheckpointFilter(event.target.value as CheckpointFilter)
                }
                aria-label="Filter checkpoints"
                className="rounded-xl border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-2.5 text-xs text-[#344337] outline-none focus:border-[#63866B]"
              >
                <option value="all">All checks</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F6F1] px-3 py-2.5">
            <p className="text-[10px] text-[#697267]">
              {currentCheckpointIndex >= 0
                ? `Checkpoint ${currentCheckpointIndex + 1} of ${activeCheckpoints.length} in the vehicle-specific sequence`
                : "Choose a checkpoint to navigate"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (currentCheckpointIndex > 0) {
                    navigateToCheckpoint(
                      activeCheckpoints[currentCheckpointIndex - 1]
                    );
                  }
                }}
                disabled={currentCheckpointIndex <= 0}
                className={demoSubtleButtonClass}
              >
                <ChevronLeft size={14} /> Previous checkpoint
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    currentCheckpointIndex >= 0 &&
                    currentCheckpointIndex < activeCheckpoints.length - 1
                  ) {
                    navigateToCheckpoint(
                      activeCheckpoints[currentCheckpointIndex + 1]
                    );
                  }
                }}
                disabled={
                  currentCheckpointIndex < 0 ||
                  currentCheckpointIndex >= activeCheckpoints.length - 1
                }
                className={demoSubtleButtonClass}
              >
                Next checkpoint <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {restoring ? (
            <div className="rounded-xl bg-[#FCFBF7] p-8 text-center text-xs text-[#92958A]">
              Restoring saved progress…
            </div>
          ) : currentSectionCheckpoints.length === 0 && !searchNormalized ? (
            <div className="rounded-xl border border-dashed border-[#E8E3D8] bg-[#FCFBF7] p-8 text-center text-xs text-[#92958A]">
              This transmission section does not apply to the selected vehicle type.
            </div>
          ) : visibleCheckpoints.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E8E3D8] bg-[#FCFBF7] p-8 text-center text-xs text-[#92958A]">
              No checkpoints match the current search and filter.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleCheckpoints.map((checkpoint, index) => {
                const sectionLabel = sourceSectionLabels[checkpoint.section_no];
                const showSearchSection =
                  searchNormalized &&
                  (index === 0 ||
                    visibleCheckpoints[index - 1].section_no !==
                      checkpoint.section_no);
                return (
                  <div
                    key={checkpoint.checkpoint_no}
                    id={`checkpoint-${checkpoint.checkpoint_no}`}
                    onFocusCapture={() =>
                      setCurrentCheckpointNo(checkpoint.checkpoint_no)
                    }
                  >
                    {showSearchSection && (
                      <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-[#A27649]">
                        SECTION {sectionLabel} · {checkpoint.section_name}
                      </p>
                    )}
                    <CheckpointAssessmentCard
                      checkpoint={checkpoint}
                      assessment={assessmentFor(session, checkpoint.checkpoint_no)}
                      applicable={
                        session.applicability[String(checkpoint.checkpoint_no)]
                      }
                      applicabilityAuthorized={Boolean(
                        applicabilityAuthorizations[
                          String(checkpoint.checkpoint_no)
                        ]
                      )}
                      canAuthorizeNotApplicable={
                        actor.profile.role === "admin"
                      }
                      authorizingNotApplicable={
                        authorizingCheckpointNo === checkpoint.checkpoint_no
                      }
                      autoValue={getAutoValue(
                        checkpoint,
                        selectedVehicle,
                        session,
                        currentGps,
                        now,
                        mechanics
                      )}
                      evidence={
                        currentEvidence[String(checkpoint.checkpoint_no)] ?? []
                      }
                      disabled={
                        !inspection ||
                        Boolean(finalizedAt) ||
                        restoring ||
                        saving ||
                        submitting
                      }
                      selectedMechanic={session.selectedMechanic}
                      mechanics={mechanics}
                      locationMessage={locationMessage}
                      locationCapturing={locationCapturing}
                      onAssessmentChange={(changes) =>
                        updateAssessment(checkpoint.checkpoint_no, changes)
                      }
                      onApplicabilityChange={(applicable) =>
                        updateApplicability(checkpoint.checkpoint_no, applicable)
                      }
                      onAuthorizeNotApplicable={() =>
                        void authorizeNotApplicable(checkpoint.checkpoint_no)
                      }
                      onMechanicChange={updateMechanic}
                      onCaptureLocation={captureLocation}
                      onEvidenceSelected={(mediaType, files) =>
                        addEvidence(checkpoint.checkpoint_no, mediaType, files)
                      }
                      onRemoveEvidence={(evidenceId) =>
                        removeEvidence(checkpoint.checkpoint_no, evidenceId)
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DemoPanel>

      <DemoPanel
        title="Final inspection review"
        description="Review persisted checkpoint assessments, required evidence, outstanding repairs and submission eligibility."
      >
        <div
          className={`rounded-xl px-4 py-3 text-xs font-semibold ${
            eligibleForSubmission
              ? "bg-[#E7F4E6] text-[#28543D]"
              : "bg-[#FFF6E9] text-[#80643A]"
          }`}
        >
          Eligible for submission: {eligibleForSubmission ? "Yes" : "No"}
          {eligibleForSubmission && failedCritical.length > 0
            ? " — submission may record failures, but safety clearance remains blocked."
            : !eligibleForSubmission
              ? ` — ${unresolvedApplicability.length} applicability decision(s), ${pendingCount} pending applicable check(s).`
              : ""}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CheckpointReviewList
            title={`Completed checks (${completedRows.length})`}
            rows={completedRows}
            empty="No fully completed checks yet."
          />
          <CheckpointReviewList
            title={`Unassessed applicable checks (${unassessedRows.length})`}
            rows={unassessedRows}
            empty="No unassessed applicable checks."
          />
          <CheckpointReviewList
            title={`Assessment incomplete (${inProgressRows.length})`}
            rows={inProgressRows}
            empty="No partial assessments."
          />
          <CheckpointReviewList
            title={`Failed critical checks (${failedCriticalRows.length})`}
            rows={failedCriticalRows}
            empty="No failed critical checks recorded."
          />
          <CheckpointReviewList
            title={`Outstanding repairs / rechecks (${outstandingRepairRows.length})`}
            rows={outstandingRepairRows}
            empty="No failed assessment currently requires repair or recheck."
          />
          <CheckpointReviewList
            title={`Missing required evidence (${evidenceMissingRows.length})`}
            rows={evidenceMissingRows}
            empty="No currently due evidence is missing."
          />
          <CheckpointReviewList
            title={`Assessed, evidence pending (${assessedEvidencePendingRows.length})`}
            rows={assessedEvidencePendingRows}
            empty="No completed assessments are waiting on evidence."
          />
        </div>
      </DemoPanel>

      <InspectionAdvisor
        analysis={inspectionAnalysis}
        vehicleName={`${selectedVehicle.make} ${selectedVehicle.model}`}
        applicableCount={applicableCheckpoints.length}
        unassessedRows={unassessedRows}
        inProgressRows={inProgressRows}
        missingEvidenceRows={evidenceMissingRows}
        unresolvedApplicability={unresolvedApplicability}
        safetyStatus={safetyStatus}
        eligibleForSubmission={eligibleForSubmission}
        finalized={Boolean(finalizedAt)}
        analysisGenerated={analysisGenerated}
        analysisGeneratedAt={analysisGeneratedAt}
        onGenerate={generateAnalysis}
      />

      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#E8E4D9] bg-white p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          {failedCritical.length > 0 ? (
            <ShieldAlert size={19} className="mt-0.5 shrink-0 text-[#B44936]" />
          ) : (
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#315D40]" />
          )}
          <div>
            <p className="text-xs font-bold text-[#344337]">
              {finalizedAt
                ? `Inspection submitted · safety ${safetyStatus.toLowerCase()}`
                : eligibleForSubmission
                  ? "All applicable checkpoints, evidence and applicability decisions are complete."
                  : `${pendingCount} applicable checkpoint(s) remain incomplete; ${unresolvedApplicability.length} conditional decision(s) remain.`}
            </p>
            <p className="mt-1 text-[10px] leading-5 text-[#92958A]">
              Submission requires every applicable assessment and due evidence. Critical failures block safety clearance and Sale Ready; unresolved equipment applicability blocks submission.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {finalizedAt ? (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className={demoButtonClass}
            >
              <FileCheck2 size={14} /> View final report
            </button>
          ) : (
            <button
              type="button"
              onClick={finalizeInspection}
              disabled={
                !eligibleForSubmission ||
                restoring ||
                saving ||
                submitting ||
                dirty
              }
              className={demoButtonClass}
              title={
                eligibleForSubmission
                  ? dirty
                    ? "Save all pending changes before submitting"
                    : "Submit the completed inspection to Supabase"
                  : "Resolve conditional applicability and complete all applicable checkpoints and required evidence first"
              }
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}{" "}
              Submit inspection
            </button>
          )}
        </div>
      </div>

      {showReport && finalizedAt && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10271C]/70 p-3 backdrop-blur-sm"
          onClick={() => setShowReport(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="final-report-title"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#FAF9F5] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#E8E3D8] bg-[#FAF9F5] p-5">
              <div>
                <p className="text-[10px] font-extrabold tracking-[1.5px] text-[#A95719]">
                  AUTHENTICATED INSPECTION REPORT
                </p>
                <h2 id="final-report-title" className="mt-1 text-lg font-bold text-[#244A36]">
                  260-point Vehicle Inspection
                </h2>
                <p className="mt-1 text-xs text-[#92958A]">
                  {selectedVehicle.make} {selectedVehicle.model} ·{" "}
                  {selectedVehicle.registration_number} ·{" "}
                  {new Date(finalizedAt).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                aria-label="Close final inspection report"
                className="rounded-lg p-2 text-[#697267] transition hover:bg-[#EEEDE4]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-3">
                <ReportValue label="Applicable checks" value={applicableCheckpoints.length} />
                <ReportValue
                  label="Submission eligible"
                  value={eligibleForSubmission ? "Yes" : "No"}
                />
                <ReportValue label="Critical failures" value={failedCritical.length} />
                <ReportValue
                  label="Final cosmetic rating"
                  value={
                    averageCosmeticScore === null
                      ? "Not recorded"
                      : `${averageCosmeticScore.toFixed(1)} / 5`
                  }
                />
                <ReportValue label="Safety clearance" value={safetyStatus} />
                <ReportValue label="Sale Ready" value={saleReady ? "Yes" : "No"} />
                <ReportValue label="Evidence missing" value={evidenceMissingCount} />
              </div>

              <section className="rounded-xl border border-[#E8E3D8] bg-white p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#244A36]">
                  <ShieldAlert size={16} className="text-[#B44936]" />
                  Critical safety failures
                </h3>
                {failedCritical.length === 0 ? (
                  <p className="mt-3 text-xs text-[#697267]">
                    No failed critical checkpoints were recorded in this completed inspection.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {failedCritical.map((checkpoint) => {
                      const assessment = assessmentFor(
                        session,
                        checkpoint.checkpoint_no
                      );
                      return (
                        <li
                          key={checkpoint.checkpoint_no}
                          className="rounded-lg bg-[#FCE9E5] p-3 text-xs text-[#763F35]"
                        >
                          <span className="font-bold">
                            #{checkpoint.checkpoint_no} · {checkpoint.name}
                          </span>
                          <span className="mt-1 block text-[10px]">
                            SECTION {sourceSectionLabels[checkpoint.section_no]} ·{" "}
                            {checkpoint.section_name}
                          </span>
                          {(assessment.issueDescription || assessment.observation) && (
                            <span className="mt-1 block">
                              {assessment.issueDescription || assessment.observation}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-[#E8E3D8] bg-white p-4">
                <h3 className="text-sm font-bold text-[#244A36]">
                  Cosmetic observations
                </h3>
                {cosmeticObservations.length === 0 ? (
                  <p className="mt-3 text-xs text-[#697267]">
                    No cosmetic ratings were recorded.
                  </p>
                ) : (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {cosmeticObservations.map((checkpoint) => (
                      <li
                        key={checkpoint.checkpoint_no}
                        className="rounded-lg bg-[#F3F4ED] p-3 text-xs text-[#526052]"
                      >
                        <span className="font-bold">
                          #{checkpoint.checkpoint_no} · {checkpoint.name}
                        </span>
                        <span className="mt-1 block">
                          Cosmetic score:{" "}
                          {assessmentFor(session, checkpoint.checkpoint_no).cosmeticScore} / 5
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[10px] text-[#92958A]">
                  Cosmetic ratings do not alter the safety clearance decision.
                </p>
              </section>

              <section className="rounded-xl border border-[#E8E3D8] bg-white p-4">
                <h3 className="text-sm font-bold text-[#244A36]">
                  Outstanding repairs / rechecks
                </h3>
                {outstandingRepairRows.length === 0 ? (
                  <p className="mt-3 text-xs text-[#697267]">
                    No failed assessments were recorded.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {outstandingRepairRows.map((row) => (
                      <li
                        key={row.checkpoint.checkpoint_no}
                        className="rounded-lg bg-[#FFF6E9] p-3 text-xs text-[#80643A]"
                      >
                        <span className="font-bold">
                          #{row.checkpoint.checkpoint_no} · {row.checkpoint.name}
                        </span>
                        <span className="mt-1 block text-[10px]">
                          SECTION {row.sectionLabel} · {row.sectionName}
                        </span>
                        <span className="mt-1 block">
                          {row.assessment.issueDescription ||
                            row.assessment.observation ||
                            "Recorded failure; repair details require workshop follow-up."}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="text-[10px] leading-5 text-[#92958A]">
                This report is available only after Supabase confirms submission. A cleared inspection is not sale-ready until quality control approves it.
              </p>
            </div>
          </div>
        </div>
      )}
    </DemoModulePage>
  );
}

function ReportValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[#F0F1E9] p-3">
      <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#344337]">{value}</p>
    </div>
  );
}

function CheckpointReviewList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: InspectionAnalysisRow[];
  empty: string;
}) {
  return (
    <details className="rounded-xl bg-[#F7F6F1] p-3">
      <summary className="cursor-pointer text-[10px] font-bold text-[#526052]">
        {title}
      </summary>
      {rows.length === 0 ? (
        <p className="mt-2 text-[9px] text-[#92958A]">{empty}</p>
      ) : (
        <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
          {rows.map((row) => (
            <li
              key={row.checkpoint.checkpoint_no}
              className="rounded-lg bg-white px-2.5 py-2 text-[9px] leading-4 text-[#697267]"
            >
              <span className="font-bold">
                #{row.checkpoint.checkpoint_no} · {row.checkpoint.name}
              </span>
              <span className="block text-[#92958A]">
                SECTION {row.sectionLabel} · {row.sectionName}
              </span>
              {(row.assessment.issueDescription ||
                row.assessment.observation) && (
                <span className="mt-1 block">
                  {row.assessment.issueDescription ||
                    row.assessment.observation}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

type WorkflowInspectionRow = {
  id: string;
  vehicle_id: string;
  status: InspectionRecord["status"];
  started_at: string;
};

type WorkflowVehicleRow = {
  id: string;
  make: string;
  model: string;
  registration_number: string;
};

function WorkshopWorkflowWorkspace({
  actor,
  supabase,
  onOpenInspection,
}: {
  actor: InspectionActor;
  supabase: ReturnType<typeof createClient>;
  onOpenInspection: () => void;
}) {
  const [inspections, setInspections] = useState<WorkflowInspectionRow[]>([]);
  const [vehicles, setVehicles] = useState<WorkflowVehicleRow[]>([]);
  const [jobs, setJobs] = useState<RepairJobRecord[]>([]);
  const [ratings, setRatings] = useState<
    Record<string, VehicleRatingRecord>
  >({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [refreshId, setRefreshId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const isMechanic = actor.profile.role === "mechanic";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage("");

    void (async () => {
      try {
        let nextJobs: RepairJobRecord[] = [];
        let nextInspections: WorkflowInspectionRow[] = [];

        if (isMechanic) {
          const { data, error } = await supabase
            .from("repair_jobs")
            .select(
              "id, inspection_id, title, description, priority, status, assigned_mechanic_id"
            )
            .eq("assigned_mechanic_id", actor.profile.id)
            .in("status", ["assigned", "in_progress", "completed"])
            .order("created_at", { ascending: false });
          if (error) {
            throw new Error(`Assigned repair jobs could not be loaded: ${error.message}`);
          }
          nextJobs = (data ?? []) as RepairJobRecord[];
        } else {
          const { data, error } = await supabase
            .from("inspections")
            .select("id, vehicle_id, status, started_at")
            .in("status", ["submitted", "repair_required", "qc_pending"])
            .order("started_at", { ascending: false })
            .limit(100);
          if (error) {
            throw new Error(`Quality queue could not be loaded: ${error.message}`);
          }
          nextInspections = (data ?? []) as WorkflowInspectionRow[];
          const inspectionIds = nextInspections.map((item) => item.id);
          if (inspectionIds.length > 0) {
            const { data: jobRows, error: jobsError } = await supabase
              .from("repair_jobs")
              .select(
                "id, inspection_id, title, description, priority, status, assigned_mechanic_id"
              )
              .in("inspection_id", inspectionIds)
              .order("created_at", { ascending: false });
            if (jobsError) {
              throw new Error(`Quality repair queue could not be loaded: ${jobsError.message}`);
            }
            nextJobs = (jobRows ?? []) as RepairJobRecord[];

            const { data: ratingRows, error: ratingsError } = await supabase
              .from("vehicle_ratings")
              .select("inspection_id, cosmetic_score, critical_failures, safety_clearance, sale_ready")
              .in("inspection_id", inspectionIds);
            if (ratingsError) {
              throw new Error(`Quality ratings could not be loaded: ${ratingsError.message}`);
            }
            setRatings(
              Object.fromEntries(
                (ratingRows ?? []).map((rating) => [
                  rating.inspection_id,
                  rating as VehicleRatingRecord,
                ])
              )
            );
          } else {
            setRatings({});
          }
        }

        const inspectionIds = [
          ...new Set([
            ...nextInspections.map((item) => item.id),
            ...nextJobs.map((job) => job.inspection_id),
          ]),
        ];
        if (isMechanic && inspectionIds.length > 0) {
          const { data, error } = await supabase
            .from("inspections")
            .select("id, vehicle_id, status, started_at")
            .in("id", inspectionIds);
          if (error) {
            throw new Error(`Assigned inspection details could not be loaded: ${error.message}`);
          }
          nextInspections = (data ?? []) as WorkflowInspectionRow[];
        }

        const vehicleIds = [
          ...new Set(nextInspections.map((item) => item.vehicle_id)),
        ];
        let nextVehicles: WorkflowVehicleRow[] = [];
        if (vehicleIds.length > 0) {
          const { data, error } = await supabase
            .from("vehicles")
            .select("id, make, model, registration_number")
            .in("id", vehicleIds);
          if (error) {
            throw new Error(`Workflow vehicle details could not be loaded: ${error.message}`);
          }
          nextVehicles = (data ?? []) as WorkflowVehicleRow[];
        }

        if (!cancelled) {
          setJobs(nextJobs);
          setInspections(nextInspections);
          setVehicles(nextVehicles);
          setNotes({});
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "The authorized workshop workflow could not be loaded."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actor.profile.id, isMechanic, refreshId, supabase]);

  async function runWorkflowAction(
    actionKey: string,
    rpcName:
      | "complete_repair_job"
      | "verify_repair_job"
      | "finalize_quality_review",
    parameters: Record<string, string | boolean>
  ) {
    if (busy) return;
    setBusy(actionKey);
    setStatusMessage("");
    try {
      const { error } = await supabase.rpc(rpcName, parameters);
      if (error) throw new Error(error.message);
      setStatusMessage("The workflow action was confirmed by Supabase.");
      setRefreshId((current) => current + 1);
    } catch (error: unknown) {
      setStatusMessage(
        error instanceof Error
          ? `Workflow action failed: ${error.message}`
          : "Workflow action failed."
      );
    } finally {
      setBusy("");
    }
  }

  const inspectionById = new Map(
    inspections.map((inspection) => [inspection.id, inspection])
  );
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  return (
    <DemoModulePage
      title={isMechanic ? "Assigned Repair Work" : "Quality Control"}
      description={
        isMechanic
          ? "Complete only repair jobs assigned to your authenticated mechanic profile."
          : "Review submitted inspections, independently verify completed repairs, and make final quality decisions."
      }
      icon={isMechanic ? Bike : ShieldCheck}
      modeLabel="LIVE WORKFLOW"
      notice={`${actor.profile.full_name} · ${actor.profile.role}. Every action is checked and recorded by Supabase.`}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E8E3D8] bg-white p-2">
        <button
          type="button"
          onClick={() => {
            const hasUnsavedNotes = Object.values(notes).some((note) =>
              note.trim().length > 0
            );
            if (
              hasUnsavedNotes &&
              !window.confirm(
                "Switching workspaces will discard unsaved repair or QC notes. Continue?"
              )
            ) {
              return;
            }
            onOpenInspection();
          }}
          className={demoButtonClass}
        >
          <ClipboardCheck size={15} />
          Open 260-point vehicle inspection
        </button>
        <span className="px-2 text-xs font-bold text-[#697267]">
          {isMechanic ? "Assigned repair work" : "Quality control"}
        </span>
      </div>
      {statusMessage && (
        <p role="status" className="rounded-xl bg-[#F3F4ED] p-3 text-xs text-[#526052]">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <div role="alert" className="rounded-xl border border-[#EBC4BA] bg-[#FCE9E5] p-4 text-sm text-[#9F4A3A]">
          {errorMessage}
        </div>
      )}
      {loading ? (
        <DemoPanel title="Loading authorized workflow">
          <div className="flex items-center gap-3 py-6 text-sm text-[#697267]" role="status">
            <Loader2 size={18} className="animate-spin text-[#315D40]" />
            Loading assigned workshop records from Supabase…
          </div>
        </DemoPanel>
      ) : isMechanic ? (
        <DemoPanel
          title="My assigned repairs"
          description="Only repairs assigned to the signed-in mechanic are shown. Completion requires a written note and subsequent QC verification."
        >
          {jobs.length === 0 ? (
            <p className="rounded-xl bg-[#FCFBF7] p-4 text-sm text-[#697267]">
              No assigned or completed repairs are waiting for your action.
            </p>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const linkedInspection = inspectionById.get(job.inspection_id);
                const vehicle = linkedInspection
                  ? vehicleById.get(linkedInspection.vehicle_id)
                  : null;
                const noteKey = `job:${job.id}`;
                return (
                  <article key={job.id} className="rounded-xl border border-[#E8E3D8] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-[#344337]">{job.title}</h3>
                        <p className="mt-1 text-[10px] text-[#92958A]">
                          {vehicle
                            ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}`
                            : "Authorized repair record"}
                        </p>
                        {job.description && (
                          <p className="mt-2 text-xs leading-5 text-[#697267]">{job.description}</p>
                        )}
                      </div>
                      <span className="rounded-full bg-[#FFF6E9] px-3 py-1.5 text-[10px] font-bold capitalize text-[#80643A]">
                        {job.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    {job.status !== "completed" && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={notes[noteKey] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [noteKey]: event.target.value,
                            }))
                          }
                          rows={3}
                          maxLength={2000}
                          placeholder="Describe the repair work performed"
                          className="w-full rounded-xl border border-[#E8E3D8] bg-[#FCFBF7] px-3 py-2.5 text-xs text-[#344337]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void runWorkflowAction(job.id, "complete_repair_job", {
                              p_repair_job_id: job.id,
                              p_note: notes[noteKey]?.trim() ?? "",
                            })
                          }
                          disabled={busy === job.id || (notes[noteKey]?.trim().length ?? 0) < 10}
                          className={demoButtonClass}
                        >
                          {busy === job.id ? "Saving…" : "Submit work for QC"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </DemoPanel>
      ) : (
        <>
          <DemoPanel
            title="Inspection quality queue"
            description="Final approval is available only after a submitted inspection passes server-side safety checks. Reinspection approvals also require verified repairs."
          >
            {inspections.length === 0 ? (
              <p className="rounded-xl bg-[#FCFBF7] p-4 text-sm text-[#697267]">
                No submitted inspections are waiting for quality review.
              </p>
            ) : (
              <div className="space-y-3">
                {inspections.map((item) => {
                  const vehicle = vehicleById.get(item.vehicle_id);
                  const rating = ratings[item.id];
                  const noteKey = `inspection:${item.id}`;
                  return (
                    <article key={item.id} className="rounded-xl border border-[#E8E3D8] bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-[#344337]">
                            {vehicle
                              ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}`
                              : "Inspection"}
                          </h3>
                          <p className="mt-1 text-[10px] text-[#92958A]">
                            {item.id} · {new Date(item.started_at).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#F3F0E7] px-3 py-1.5 text-[10px] font-bold capitalize text-[#697267]">
                          {item.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      {rating && (
                        <p className="mt-3 text-xs text-[#697267]">
                          Safety: <strong>{rating.safety_clearance}</strong> · Critical failures:{" "}
                          <strong>{rating.critical_failures}</strong> · Sale ready:{" "}
                          <strong>{rating.sale_ready ? "Yes" : "No"}</strong>
                        </p>
                      )}
                      {["submitted", "qc_pending"].includes(item.status) && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={notes[noteKey] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [noteKey]: event.target.value,
                              }))
                            }
                            rows={2}
                            maxLength={2000}
                            placeholder="Record the final QC decision and rationale"
                            className="w-full rounded-xl border border-[#E8E3D8] bg-[#FCFBF7] px-3 py-2.5 text-xs text-[#344337]"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void runWorkflowAction(`approve:${item.id}`, "finalize_quality_review", {
                                  p_inspection_id: item.id,
                                  p_approved: true,
                                  p_notes: notes[noteKey]?.trim() ?? "",
                                })
                              }
                              disabled={busy === `approve:${item.id}` || (notes[noteKey]?.trim().length ?? 0) < 5}
                              className={demoButtonClass}
                            >
                              Approve and mark sale ready
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void runWorkflowAction(`reject:${item.id}`, "finalize_quality_review", {
                                  p_inspection_id: item.id,
                                  p_approved: false,
                                  p_notes: notes[noteKey]?.trim() ?? "",
                                })
                              }
                              disabled={busy === `reject:${item.id}` || (notes[noteKey]?.trim().length ?? 0) < 5}
                              className={demoSubtleButtonClass}
                            >
                              Reject review
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </DemoPanel>

          <DemoPanel
            title="Completed repairs awaiting verification"
            description="Approve a completed repair or return it to the assigned mechanic with a documented reason."
          >
            {jobs.filter((job) => job.status === "completed").length === 0 ? (
              <p className="rounded-xl bg-[#FCFBF7] p-4 text-sm text-[#697267]">
                No completed repair jobs are waiting for verification.
              </p>
            ) : (
              <div className="space-y-3">
                {jobs
                  .filter((job) => job.status === "completed")
                  .map((job) => {
                    const linkedInspection = inspectionById.get(job.inspection_id);
                    const vehicle = linkedInspection
                      ? vehicleById.get(linkedInspection.vehicle_id)
                      : null;
                    const noteKey = `job:${job.id}`;
                    return (
                      <article key={job.id} className="rounded-xl border border-[#E8E3D8] bg-white p-4">
                        <h3 className="text-sm font-bold text-[#344337]}">
                          {job.title}
                        </h3>
                        <p className="mt-1 text-[10px] text-[#92958A]">
                          {vehicle
                            ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}`
                            : "Authorized repair record"}
                        </p>
                        <textarea
                          value={notes[noteKey] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [noteKey]: event.target.value,
                            }))
                          }
                          rows={2}
                          maxLength={2000}
                          placeholder="Document the repair verification"
                          className="mt-3 w-full rounded-xl border border-[#E8E3D8] bg-[#FCFBF7] px-3 py-2.5 text-xs text-[#344337]"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void runWorkflowAction(`verify:${job.id}`, "verify_repair_job", {
                                p_repair_job_id: job.id,
                                p_approved: true,
                                p_notes: notes[noteKey]?.trim() ?? "",
                              })
                            }
                            disabled={busy === `verify:${job.id}` || (notes[noteKey]?.trim().length ?? 0) < 5}
                            className={demoButtonClass}
                          >
                            Verify repair
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void runWorkflowAction(`reject:${job.id}`, "verify_repair_job", {
                                p_repair_job_id: job.id,
                                p_approved: false,
                                p_notes: notes[noteKey]?.trim() ?? "",
                              })
                            }
                            disabled={busy === `reject:${job.id}` || (notes[noteKey]?.trim().length ?? 0) < 5}
                            className={demoSubtleButtonClass}
                          >
                            Return to mechanic
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
          </DemoPanel>
        </>
      )}
    </DemoModulePage>
  );
}
