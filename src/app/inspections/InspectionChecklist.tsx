"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bike,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Search,
  RotateCcw,
  Save,
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
  type DemoMechanic,
  type LocalEvidence,
} from "./CheckpointAssessmentCard";
import {
  createEmptyAssessment,
  createEmptyDemoSession,
  demoSessionSchema,
  hasRequiredEvidence,
  inspectionChecklist,
  isAssessmentComplete,
  isAssessmentStarted,
  isCriticalFailure,
  sourceSectionLabels,
  type CheckpointAssessment,
  type DemoInspectionSession,
  type InspectionCheckpoint,
} from "./checklist-model";
import InspectionAdvisor from "./InspectionAdvisor";
import {
  buildInspectionAnalysis,
  type InspectionAnalysisRow,
} from "./inspection-analysis";

type CheckpointFilter = "all" | "pending" | "completed" | "failed" | "critical";

type DemoVehicle = {
  id: string;
  make: string;
  model: string;
  variant: string;
  registration: string;
  vehicleType: "motorcycle" | "scooter";
};

type GpsCoordinates = {
  latitude: number;
  longitude: number;
};

const demoVehicles: DemoVehicle[] = [
  {
    id: "DEMO-KA03-MN4821",
    make: "Honda",
    model: "Activa 6G",
    variant: "Deluxe",
    registration: "KA 03 MN 4821",
    vehicleType: "scooter",
  },
  {
    id: "DEMO-MH12-QX6314",
    make: "Bajaj",
    model: "Pulsar N160",
    variant: "Dual Channel ABS",
    registration: "MH 12 QX 6314",
    vehicleType: "motorcycle",
  },
  {
    id: "DEMO-TN09-CF2758",
    make: "TVS",
    model: "Jupiter 125",
    variant: "SmartXonnect",
    registration: "TN 09 CF 2758",
    vehicleType: "scooter",
  },
  {
    id: "DEMO-KA05-PV7316",
    make: "Royal Enfield",
    model: "Hunter 350",
    variant: "Metro",
    registration: "KA 05 PV 7316",
    vehicleType: "motorcycle",
  },
];

const demoMechanics: DemoMechanic[] = [
  { id: "DEMO-MECH-01", name: "Aarav Menon" },
  { id: "DEMO-MECH-02", name: "Meera Nair" },
  { id: "DEMO-MECH-03", name: "Kabir Shah" },
];

const sessionStoragePrefix = "inspection-engine-demo-inspection-v1";

function createSessionForVehicle(vehicle: DemoVehicle): DemoInspectionSession {
  return {
    ...createEmptyDemoSession(),
    assessments: {
      "14": {
        ...createEmptyAssessment(),
        resultStatus: "recorded",
        recordedValue: vehicle.vehicleType,
      },
    },
  };
}

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
  vehicle: DemoVehicle,
  session: DemoInspectionSession,
  gps: GpsCoordinates | null,
  now: number
) {
  switch (checkpoint.checkpoint_no) {
    case 14:
      return vehicle.vehicleType;
    case 15:
      return session.startedAt
        ? new Date(session.startedAt).toLocaleString("en-IN")
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
      return session.selectedMechanic;
    case 19:
      return session.startedAt
        ? formatDuration(session.startedAt, now)
        : "";
    default:
      return "";
  }
}

function assessmentFor(
  session: DemoInspectionSession,
  checkpointNo: number
): CheckpointAssessment {
  return session.assessments[String(checkpointNo)] ?? createEmptyAssessment();
}

function isCheckpointComplete(
  checkpoint: InspectionCheckpoint,
  session: DemoInspectionSession,
  vehicle: DemoVehicle,
  gps: GpsCoordinates | null,
  now: number,
  evidence: LocalEvidence[]
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
      getAutoValue(checkpoint, vehicle, session, gps, now)
    ) &&
    (notApplicable || hasRequiredEvidence(checkpoint.evidence_required, evidence))
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

function restoreDemoSession(vehicle: DemoVehicle) {
  const initialSession = createSessionForVehicle(vehicle);
  try {
    const stored = window.sessionStorage.getItem(
      `${sessionStoragePrefix}:${vehicle.id}`
    );
    if (!stored) return { session: initialSession, message: "" };

    let value: unknown;
    try {
      value = JSON.parse(stored);
    } catch {
      return {
        session: initialSession,
        message: "Saved demo progress could not be read; a blank demo checklist was loaded.",
      };
    }

    const parsed = demoSessionSchema.safeParse(value);
    if (!parsed.success) {
      return {
        session: initialSession,
        message: "Saved demo progress was invalid; a blank demo checklist was loaded.",
      };
    }

    const categoryAssessment = {
      ...createEmptyAssessment(),
      resultStatus: "recorded" as const,
      recordedValue: vehicle.vehicleType,
    };

    return {
      session: {
        ...parsed.data,
        assessments: {
          ...parsed.data.assessments,
          "14": categoryAssessment,
        },
      },
      message:
        "Restored demo progress from this browser tab. Evidence files must be attached again.",
    };
  } catch (error) {
    return {
      session: initialSession,
      message:
        error instanceof Error
          ? `Browser session storage is unavailable: ${error.message}`
          : "Browser session storage is unavailable; progress is in memory only.",
    };
  }
}

export default function InspectionChecklist() {
  const [selectedVehicleId, setSelectedVehicleId] = useState(demoVehicles[0].id);
  const [session, setSession] = useState(() =>
    createSessionForVehicle(demoVehicles[0])
  );
  const [evidenceByVehicle, setEvidenceByVehicle] = useState<
    Record<string, Record<string, LocalEvidence[]>>
  >({});
  const [gpsByVehicle, setGpsByVehicle] = useState<
    Record<string, GpsCoordinates | null>
  >({});
  const [activeSectionNo, setActiveSectionNo] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
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
    demoVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    demoVehicles[0];
  const currentGps = gpsByVehicle[selectedVehicleId] ?? null;
  const currentEvidence = useMemo(
    () => evidenceByVehicle[selectedVehicleId] ?? {},
    [evidenceByVehicle, selectedVehicleId]
  );

  useEffect(() => {
    setRestoring(true);
    const restored = restoreDemoSession(selectedVehicle);
    setSession(restored.session);
    setSavingMessage(restored.message);
    setGpsByVehicle((current) => ({ ...current, [selectedVehicleId]: null }));
    setFinalizedAt(null);
    setLocationMessage("");
    setRestoring(false);
  }, [selectedVehicle, selectedVehicleId]);

  useEffect(() => {
    if (!session.startedAt || finalizedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [finalizedAt, session.startedAt]);

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    },
    []
  );

  const activeCheckpoints = useMemo(
    () =>
      inspectionChecklist.checkpoints.filter((checkpoint) => {
        const supportsVehicle =
          checkpoint.active_for === "both" ||
          checkpoint.active_for === selectedVehicle.vehicleType;
        const scooterFuelLock =
          checkpoint.checkpoint_no !== 115 ||
          selectedVehicle.vehicleType === "scooter";
        return supportsVehicle && scooterFuelLock;
      }),
    [selectedVehicle.vehicleType]
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
        (checkpoint) =>
          checkpoint.is_conditional &&
          session.applicability[String(checkpoint.checkpoint_no)] == null
      ),
    [activeCheckpoints, session.applicability]
  );
  const progressByCheckpoint = useMemo(() => {
    const result = new Map<number, boolean>();
    activeCheckpoints.forEach((checkpoint) => {
      result.set(
        checkpoint.checkpoint_no,
        isCheckpointComplete(
          checkpoint,
          session,
          selectedVehicle,
          currentGps,
          now,
          currentEvidence[String(checkpoint.checkpoint_no)] ?? []
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
    session,
  ]);
  const analysisRows = useMemo<InspectionAnalysisRow[]>(
    () =>
      applicableCheckpoints.map((checkpoint) => {
        const key = String(checkpoint.checkpoint_no);
        const assessment = assessmentFor(session, checkpoint.checkpoint_no);
        const applicable = session.applicability[key];
        const autoValue = getAutoValue(
          checkpoint,
          selectedVehicle,
          session,
          currentGps,
          now
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
      }),
    [
      applicableCheckpoints,
      currentEvidence,
      currentGps,
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
  const evidenceMissingCount = evidenceMissingRows.length;
  const overallProgress =
    applicableCheckpoints.length === 0
      ? 0
      : Math.round((completedCount / applicableCheckpoints.length) * 100);
  const inspectionComplete =
    applicableCheckpoints.length > 0 &&
    pendingCount === 0 &&
    unresolvedApplicability.length === 0;
  const eligibleForSubmission = inspectionComplete;
  const saleReady = Boolean(finalizedAt && inspectionComplete && failedCritical.length === 0);
  const safetyStatus =
    failedCritical.length > 0
      ? "Blocked"
      : finalizedAt
        ? "Cleared"
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
  const averageCosmeticScore =
    cosmeticScores.length > 0
      ? cosmeticScores.reduce((total, score) => total + score, 0) /
        cosmeticScores.length
      : null;
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
    vehicleName: `${selectedVehicle.make} ${selectedVehicle.model}`,
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
    if (finalizedAt) return;
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
    setSavingMessage("");
  }

  function updateMechanic(mechanicId: string) {
    if (finalizedAt) return;
    setSession((current) => ({ ...current, selectedMechanic: mechanicId }));
    setSavingMessage("");
  }

  function updateApplicability(
    checkpointNo: number,
    applicable: boolean | null
  ) {
    if (finalizedAt) return;
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
    setSavingMessage("");
  }

  function handleVehicleChange(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    setActiveSectionNo(1);
    setCurrentCheckpointNo(1);
    setFinalizedAt(null);
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

  function startInspection() {
    if (session.startedAt || finalizedAt) return;
    setSession((current) => ({
      ...current,
      startedAt: new Date().toISOString(),
    }));
    setNow(Date.now());
    setSavingMessage("");
  }

  function saveDemoProgress() {
    try {
      window.sessionStorage.setItem(
        `${sessionStoragePrefix}:${selectedVehicleId}`,
        JSON.stringify(session)
      );
      setSavingMessage(
        "Demo progress saved to this browser tab only. Evidence files and GPS are not saved or uploaded."
      );
    } catch (error) {
      setSavingMessage(
        error instanceof Error
          ? `Could not save demo progress to this browser tab: ${error.message}`
          : "Could not save demo progress to this browser tab. Changes remain in memory only."
      );
    }
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
        setGpsByVehicle((current) => ({
          ...current,
          [selectedVehicleId]: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        }));
        setLocationMessage("GPS captured locally for this page session.");
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
    if (!files || files.length === 0) return;
    const acceptedFiles = Array.from(files).filter((file) =>
      file.type.startsWith(mediaType === "photo" ? "image/" : "video/")
    );
    const rejectedCount = files.length - acceptedFiles.length;
    const additions = acceptedFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.add(previewUrl);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        mediaType,
        previewUrl,
      } satisfies LocalEvidence;
    });

    if (rejectedCount > 0) {
      setSavingMessage(
        `${rejectedCount} file(s) were not added because their media type did not match the evidence field.`
      );
    } else {
      setSavingMessage("");
    }

    setEvidenceByVehicle((current) => {
      const vehicleEvidence = current[selectedVehicleId] ?? {};
      const key = String(checkpointNo);
      return {
        ...current,
        [selectedVehicleId]: {
          ...vehicleEvidence,
          [key]: [...(vehicleEvidence[key] ?? []), ...additions],
        },
      };
    });
  }

  function removeEvidence(checkpointNo: number, evidenceId: string) {
    const vehicleEvidence = evidenceByVehicle[selectedVehicleId] ?? {};
    const key = String(checkpointNo);
    const item = (vehicleEvidence[key] ?? []).find(
      (evidence) => evidence.id === evidenceId
    );
    if (item) {
      URL.revokeObjectURL(item.previewUrl);
      objectUrls.current.delete(item.previewUrl);
    }
    setEvidenceByVehicle((current) => {
      const existing = current[selectedVehicleId] ?? {};
      return {
        ...current,
        [selectedVehicleId]: {
          ...existing,
          [key]: (existing[key] ?? []).filter(
            (evidence) => evidence.id !== evidenceId
          ),
        },
      };
    });
  }

  function finalizeInspection() {
    if (!eligibleForSubmission || finalizedAt) return;
    const finalizedOn = new Date();
    setNow(finalizedOn.getTime());
    setFinalizedAt(finalizedOn.toISOString());
    setSavingMessage(
      failedCritical.length > 0
        ? "Demo inspection finalized. Critical failures block safety clearance and Sale Ready."
        : "Demo inspection finalized. Safety clearance is based on critical results, not cosmetic ratings."
    );
  }

  function resetInspection() {
    if (finalizedAt) return;
    const empty = createSessionForVehicle(selectedVehicle);
    Object.values(currentEvidence)
      .flat()
      .forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
        objectUrls.current.delete(item.previewUrl);
      });
    setSession(empty);
    setEvidenceByVehicle((current) => ({
      ...current,
      [selectedVehicleId]: {},
    }));
    setGpsByVehicle((current) => ({ ...current, [selectedVehicleId]: null }));
    setActiveSectionNo(1);
    setCurrentCheckpointNo(1);
    setSearchTerm("");
    setCheckpointFilter("all");
    setAnalysisGenerated(false);
    setAnalysisGeneratedAt(null);
    setLocationMessage("");
    try {
      window.sessionStorage.removeItem(
        `${sessionStoragePrefix}:${selectedVehicleId}`
      );
      setSavingMessage(
        "Current demo checklist and saved tab progress were reset. No database records were changed."
      );
    } catch (error) {
      setSavingMessage(
        error instanceof Error
          ? `Checklist reset in memory, but saved tab progress could not be removed: ${error.message}`
          : "Checklist reset in memory, but saved tab progress could not be removed."
      );
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

  return (
    <DemoModulePage
      title="260-point Vehicle Inspection"
      description="Assess every applicable checkpoint using the master checklist. All progress, ratings and evidence remain in this browser demo."
      icon={ClipboardCheck}
    >
      <DemoPanel
        title="Demo vehicle and inspection session"
        description="Sample vehicle identities only. Checkpoints start unassessed; no pass or inspection result is prefilled."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-[#697267]">
              Demo vehicle
            </span>
            <select
              value={selectedVehicleId}
              onChange={(event) => handleVehicleChange(event.target.value)}
              className="w-full rounded-xl border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-3 text-sm text-[#344337] outline-none focus:border-[#63866B]"
            >
              {demoVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.make} {vehicle.model} · {vehicle.registration} ·{" "}
                  {vehicle.vehicleType}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-[10px] text-[#92958A]">
              {selectedVehicle.id} · DEMO VEHICLE
            </span>
          </label>

          <button
            type="button"
            onClick={startInspection}
            disabled={Boolean(session.startedAt) || Boolean(finalizedAt)}
            className={demoButtonClass}
          >
            {session.startedAt ? (
              <>
                <CheckCircle2 size={15} /> Inspection started
              </>
            ) : (
              <>
                <ClipboardCheck size={15} /> Start demo inspection
              </>
            )}
          </button>

          <button
            type="button"
            onClick={saveDemoProgress}
            disabled={restoring}
            className={demoSubtleButtonClass}
          >
            <Save size={14} /> Save demo progress
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EEE7] pt-4">
          <div className="flex items-center gap-2 text-xs">
            <Bike size={15} className="text-[#315D40]" />
            <span className="font-semibold text-[#344337]">
              {selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.variant}
            </span>
            <span className="text-[#92958A]">{selectedVehicle.registration}</span>
          </div>
          <p className="text-[10px] text-[#92958A]">
            Browser-tab demo only · no Supabase writes · evidence is not uploaded
          </p>
        </div>
        {savingMessage && (
          <p
            role="status"
            className="mt-3 rounded-lg bg-[#F3F4ED] px-3 py-2 text-[10px] leading-5 text-[#526052]"
          >
            {savingMessage}
          </p>
        )}
      </DemoPanel>

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
        description={`The master contains 260 checkpoints. ${applicableCheckpoints.length} are currently applicable to this ${selectedVehicle.vehicleType}. Vehicle-specific checks are filtered; unresolved equipment checks stay outside the progress denominator until applicability is confirmed.`}
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
              Restoring demo progress…
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
                      autoValue={getAutoValue(
                        checkpoint,
                        selectedVehicle,
                        session,
                        currentGps,
                        now
                      )}
                      evidence={
                        currentEvidence[String(checkpoint.checkpoint_no)] ?? []
                      }
                      disabled={Boolean(finalizedAt) || restoring}
                      selectedMechanic={session.selectedMechanic}
                      mechanics={demoMechanics}
                      locationMessage={locationMessage}
                      locationCapturing={locationCapturing}
                      onAssessmentChange={(changes) =>
                        updateAssessment(checkpoint.checkpoint_no, changes)
                      }
                      onApplicabilityChange={(applicable) =>
                        updateApplicability(checkpoint.checkpoint_no, applicable)
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
        description="Review recorded results, outstanding items and submission eligibility before finalizing this browser-only demo inspection."
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
                ? `Demo inspection finalized · safety ${safetyStatus.toLowerCase()}`
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
          <button
            type="button"
            onClick={resetInspection}
            disabled={Boolean(finalizedAt) || restoring}
            className={demoSubtleButtonClass}
          >
            <RotateCcw size={14} /> Reset
          </button>
          {finalizedAt ? (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className={demoButtonClass}
            >
              <FileCheck2 size={14} /> View final demo report
            </button>
          ) : (
            <button
              type="button"
              onClick={finalizeInspection}
              disabled={!eligibleForSubmission || restoring}
              className={demoButtonClass}
              title={
                eligibleForSubmission
                  ? "Finalize this demo inspection"
                  : "Resolve conditional applicability and complete all applicable checkpoints and due evidence first"
              }
            >
              <CheckCircle2 size={14} /> Finalize demo inspection
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
                  FRONTEND-ONLY DEMO REPORT
                </p>
                <h2 id="final-report-title" className="mt-1 text-lg font-bold text-[#244A36]">
                  260-point Vehicle Inspection
                </h2>
                <p className="mt-1 text-xs text-[#92958A]">
                  {selectedVehicle.make} {selectedVehicle.model} ·{" "}
                  {selectedVehicle.registration} ·{" "}
                  {new Date(finalizedAt).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                aria-label="Close final demo report"
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
                  label="Cosmetic average"
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
                    No failed critical checkpoints were recorded in this completed demo inspection.
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

              <p className="text-[10px] leading-5 text-[#92958A]">
                Illustrative local demo output only. This report, ratings, checklist results, and evidence are not saved to Supabase or represented as a real inspection.
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
