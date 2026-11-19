"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bike,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
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
  isCriticalFailure,
  sourceSectionLabels,
  type CheckpointAssessment,
  type DemoInspectionSession,
  type InspectionCheckpoint,
} from "./checklist-model";

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
  const completedCount = [...progressByCheckpoint.values()].filter(Boolean).length;
  const pendingCount = activeCheckpoints.length - completedCount;
  const failedCritical = activeCheckpoints.filter((checkpoint) =>
    isCriticalFailure(
      checkpoint,
      assessmentFor(session, checkpoint.checkpoint_no)
    )
  );
  const evidenceMissingCount = activeCheckpoints.filter((checkpoint) => {
    if (checkpoint.evidence_required === "Not required") return false;
    const assessment = assessmentFor(session, checkpoint.checkpoint_no);
    if (
      checkpoint.is_conditional &&
      session.applicability[String(checkpoint.checkpoint_no)] === false &&
      assessment.resultStatus === "not_applicable"
    ) {
      return false;
    }
    return !hasRequiredEvidence(
      checkpoint.evidence_required,
      currentEvidence[String(checkpoint.checkpoint_no)] ?? []
    );
  }).length;
  const overallProgress =
    activeCheckpoints.length === 0
      ? 0
      : Math.round((completedCount / activeCheckpoints.length) * 100);
  const inspectionComplete =
    activeCheckpoints.length > 0 && pendingCount === 0;
  const saleReady = Boolean(finalizedAt && inspectionComplete && failedCritical.length === 0);
  const safetyStatus = !finalizedAt
    ? "Not finalized"
    : failedCritical.length > 0
      ? "Blocked"
      : "Cleared";
  const cosmeticScores = activeCheckpoints
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
  const cosmeticObservations = activeCheckpoints.filter((checkpoint) => {
    if (
      checkpoint.classification !== "Cosmetic" &&
      checkpoint.classification !== "Mixed"
    ) {
      return false;
    }
    return assessmentFor(session, checkpoint.checkpoint_no).cosmeticScore !== null;
  });

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
    setFinalizedAt(null);
    setLocationCapturing(false);
    setShowReport(false);
    setSavingMessage("");
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
    if (!inspectionComplete || finalizedAt) return;
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
    const sectionCheckpoints = activeCheckpoints.filter(
      (checkpoint) => checkpoint.section_no === sectionNo
    );
    if (sectionCheckpoints.length === 0) return null;
    const complete = sectionCheckpoints.filter(
      (checkpoint) => progressByCheckpoint.get(checkpoint.checkpoint_no)
    ).length;
    return {
      complete,
      total: sectionCheckpoints.length,
      percentage: Math.round((complete / sectionCheckpoints.length) * 100),
    };
  }

  return (
    <DemoModulePage
      title="260-point Vehicle Inspection"
      description="Assess every applicable checkpoint using the VINOD master checklist. All progress, ratings and evidence remain in this browser demo."
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard
          label="Completed checkpoints"
          value={`${completedCount} / ${activeCheckpoints.length}`}
          detail={`${overallProgress}% of applicable checks`}
          icon={CheckCircle2}
        />
        <DemoMetricCard
          label="Pending checkpoints"
          value={pendingCount}
          detail="Unassessed or missing required evidence"
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
          detail="Required photo/video not attached"
          icon={FileCheck2}
          accent="amber"
        />
      </section>

      <DemoPanel
        title="Inspection completion"
        description={`The master source contains 260 checkpoints. ${activeCheckpoints.length} apply to this ${selectedVehicle.vehicleType}; manual and scooter CVT sections are filtered by vehicle type.`}
      >
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-[#475448]">
            Overall applicable-checkpoint completion
          </span>
          <span className="font-bold text-[#28543D]">{overallProgress}%</span>
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
                onClick={() => setActiveSectionNo(section.section_no)}
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
                    ? `${progress.complete} of ${progress.total} checkpoints complete`
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
                  {progress ? `${progress.percentage}%` : "—"}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-[#F0EEE7] pt-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[1.5px] text-[#A27649]">
                SECTION {sourceSectionLabels[activeSectionNo]}
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#244A36]">
                {currentSection?.name}
              </h2>
            </div>
            <p className="text-[10px] text-[#92958A]">
              {currentSectionCheckpoints.length > 0
                ? `${sectionStatus(activeSectionNo)?.complete ?? 0} / ${currentSectionCheckpoints.length} complete`
                : "Not applicable to this vehicle type"}
            </p>
          </div>

          {restoring ? (
            <div className="rounded-xl bg-[#FCFBF7] p-8 text-center text-xs text-[#92958A]">
              Restoring demo progress…
            </div>
          ) : currentSectionCheckpoints.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E8E3D8] bg-[#FCFBF7] p-8 text-center text-xs text-[#92958A]">
              This transmission section does not apply to the selected vehicle type.
            </div>
          ) : (
            <div className="space-y-3">
              {currentSectionCheckpoints.map((checkpoint) => (
                <CheckpointAssessmentCard
                  key={checkpoint.checkpoint_no}
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
                  onMechanicChange={(mechanicId) =>
                    updateMechanic(mechanicId)
                  }
                  onCaptureLocation={captureLocation}
                  onEvidenceSelected={(mediaType, files) =>
                    addEvidence(checkpoint.checkpoint_no, mediaType, files)
                  }
                  onRemoveEvidence={(evidenceId) =>
                    removeEvidence(checkpoint.checkpoint_no, evidenceId)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </DemoPanel>

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
                : inspectionComplete
                  ? "All applicable checkpoints and required evidence are complete."
                  : `${pendingCount} applicable checkpoint(s) remain incomplete.`}
            </p>
            <p className="mt-1 text-[10px] leading-5 text-[#92958A]">
              Finalization is blocked until every applicable checkpoint is assessed and required evidence is attached. Critical failures block clearance and Sale Ready.
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
              disabled={!inspectionComplete || restoring}
              className={demoButtonClass}
              title={
                inspectionComplete
                  ? "Finalize this demo inspection"
                  : "Complete all applicable checkpoints and required evidence first"
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
                <ReportValue label="Applicable checks" value={activeCheckpoints.length} />
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
                          {assessment.issueDescription && (
                            <span className="mt-1 block">
                              {assessment.issueDescription}
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
