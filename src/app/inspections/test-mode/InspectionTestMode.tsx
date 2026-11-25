"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileImage,
  Film,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TestTube2,
  XCircle,
} from "lucide-react";
import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
  demoButtonClass,
  demoSubtleButtonClass,
} from "@/app/_components/DemoModuleShell";
import { getInspectionChecklist } from "@/lib/supabase/checklist";
import { createClient } from "@/lib/supabase/client";
import {
  getInspectionActor,
  type InspectionActor,
} from "@/lib/supabase/staff";
import {
  hasRequiredEvidence,
  isAssessmentComplete,
  isCriticalFailure,
  sourceSectionLabels,
  type InspectionChecklistData,
  type InspectionCheckpoint,
} from "../checklist-model";
import {
  createInspectionSimulation,
  getInspectionSimulationSummary,
  getRequiredSimulationMedia,
  setSimulationApplicability,
  type InspectionSimulation,
  type SimulationVehicle,
} from "../test-mode-model";
import {
  createTestModeResult,
  getTestModeSubmissionErrors,
  submitTestModeSimulation,
} from "../test-mode-results";

type AccessState = "loading" | "admin" | "denied" | "error";

function isCheckpointAssessmentComplete(
  checkpoint: InspectionCheckpoint,
  simulation: InspectionSimulation,
  key: string
) {
  const assessment = simulation.assessments[key];
  if (!assessment) return false;
  const applicable = checkpoint.is_conditional
    ? simulation.applicability[key]
    : undefined;
  const notApplicable = checkpoint.is_conditional && applicable === false;
  return (
    isAssessmentComplete(
      checkpoint,
      assessment,
      applicable,
      simulation.autoValues[key] ?? ""
    ) &&
    (notApplicable ||
      hasRequiredEvidence(
        checkpoint.evidence_required,
        simulation.evidence[key] ?? []
      ))
  );
}

export default function InspectionTestMode() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("loading");
  const [actor, setActor] = useState<InspectionActor | null>(null);
  const [checklist, setChecklist] = useState<InspectionChecklistData | null>(
    null
  );
  const [vehicles, setVehicles] = useState<SimulationVehicle[]>([]);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<
    "all" | "motorcycle" | "scooter"
  >("all");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedSectionNo, setSelectedSectionNo] = useState(1);
  const [simulation, setSimulation] = useState<InspectionSimulation | null>(
    null
  );
  const [submissionPreviewRequested, setSubmissionPreviewRequested] =
    useState(false);
  const [submissionErrors, setSubmissionErrors] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAccess("loading");
    setErrorMessage("");

    void (async () => {
      try {
        const authenticatedActor = await getInspectionActor(supabase);
        if (cancelled) return;
        if (!authenticatedActor || authenticatedActor.profile.role !== "admin") {
          setActor(null);
          setAccess("denied");
          return;
        }

        setActor(authenticatedActor);
        const [loadedChecklist, vehicleResult] = await Promise.all([
          getInspectionChecklist(supabase),
          supabase
            .from("vehicles")
            .select(
              "id, make, model, variant, registration_number, vehicle_type, fuel_type, engine_capacity, manufacturing_year, registration_year, colour, chassis_number, engine_number, odometer_reading_km, owner_count, has_abs, has_parking_brake, has_catalytic_converter"
            )
            .order("registration_number"),
        ]);
        if (vehicleResult.error) {
          throw new Error(
            `Registered vehicles could not be loaded: ${vehicleResult.error.message}`
          );
        }
        if (!loadedChecklist) {
          throw new Error(
            "The live checklist is empty. Test Mode requires all 22 sections and 260 master checkpoints."
          );
        }
        if (cancelled) return;

        const registeredVehicles = (vehicleResult.data ??
          []) as SimulationVehicle[];
        setChecklist(loadedChecklist);
        setVehicles(registeredVehicles);
        setSelectedVehicleId(registeredVehicles[0]?.id ?? "");
        setAccess("admin");
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Inspection Test Mode could not be initialized."
          );
          setAccess("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const filteredVehicles = useMemo(
    () =>
      vehicleTypeFilter === "all"
        ? vehicles
        : vehicles.filter(
            (vehicle) => vehicle.vehicle_type === vehicleTypeFilter
          ),
    [vehicleTypeFilter, vehicles]
  );
  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    filteredVehicles[0] ??
    null;
  const summary =
    checklist && selectedVehicle && simulation
      ? getInspectionSimulationSummary(
          checklist.sections,
          checklist.checkpoints,
          selectedVehicle,
          simulation
        )
      : null;
  const visibleCheckpoints = useMemo(() => {
    if (!checklist || !selectedVehicle) return [];
    return checklist.checkpoints.filter(
      (checkpoint) =>
        checkpoint.section_no === selectedSectionNo &&
        (checkpoint.active_for === "both" ||
          checkpoint.active_for === selectedVehicle.vehicle_type)
    );
  }, [checklist, selectedSectionNo, selectedVehicle]);

  function chooseVehicleType(value: "all" | "motorcycle" | "scooter") {
    setVehicleTypeFilter(value);
    const nextVehicles =
      value === "all"
        ? vehicles
        : vehicles.filter((vehicle) => vehicle.vehicle_type === value);
    setSelectedVehicleId(nextVehicles[0]?.id ?? "");
    setSimulation(null);
    setSubmissionPreviewRequested(false);
    setSubmissionErrors([]);
  }

  function chooseVehicle(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    setSimulation(null);
    setSubmissionPreviewRequested(false);
    setSubmissionErrors([]);
  }

  function generateTestData() {
    if (!checklist || !selectedVehicle) return;
    setSimulation(
      createInspectionSimulation(
        checklist.checkpoints,
        selectedVehicle,
        `${selectedVehicle.id}:${Date.now()}`
      )
    );
    setSubmissionPreviewRequested(false);
    setSubmissionErrors([]);
  }

  function resetSimulation() {
    setSimulation(null);
    setSubmissionPreviewRequested(false);
    setSubmissionErrors([]);
  }

  function changeApplicability(
    checkpoint: InspectionCheckpoint,
    value: string
  ) {
    if (!simulation || !selectedVehicle) return;
    const applicable =
      value === "yes" ? true : value === "no" ? false : null;
    setSimulation(
      setSimulationApplicability(
        simulation,
        checkpoint,
        selectedVehicle,
        applicable
      )
    );
    setSubmissionErrors([]);
  }

  function clearCheckpoint(checkpointNo: number) {
    if (!simulation) return;
    const key = String(checkpointNo);
    const assessments = { ...simulation.assessments };
    const evidence = { ...simulation.evidence };
    const autoValues = { ...simulation.autoValues };
    delete assessments[key];
    delete evidence[key];
    delete autoValues[key];
    setSimulation({ ...simulation, assessments, evidence, autoValues });
    setSubmissionErrors([]);
  }

  function removeTestEvidence(checkpointNo: number) {
    if (!simulation) return;
    setSimulation({
      ...simulation,
      evidence: {
        ...simulation.evidence,
        [String(checkpointNo)]: [],
      },
    });
    setSubmissionErrors([]);
  }

  function simulateSubmission() {
    if (!summary || !simulation || !selectedVehicle || !checklist) return;
    setSubmissionPreviewRequested(true);
    const errors = getTestModeSubmissionErrors(summary);
    setSubmissionErrors(errors);
    if (errors.length > 0) return;

    try {
      const result = createTestModeResult(
        `test-${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
        new Date().toISOString(),
        selectedVehicle,
        checklist.checkpoints,
        simulation,
        summary
      );
      const submission = submitTestModeSimulation(
        summary,
        result,
        (path) => router.push(path)
      );
      if (!submission.success) {
        setSubmissionErrors(submission.errors);
      }
    } catch (error: unknown) {
      setSubmissionErrors([
        error instanceof Error
          ? error.message
          : "The Test Mode result could not be saved. No navigation occurred.",
      ]);
    }
  }

  if (access === "loading") {
    return (
      <DemoModulePage
        title="Inspection Test Mode"
        description="Verifying administrator access before loading test data."
        icon={TestTube2}
        modeLabel="ADMIN CHECK"
        notice="Test data is isolated from live inspection records."
      >
        <DemoPanel title="Checking access">
          <div className="flex items-center gap-3 py-6 text-sm text-[#697267]" role="status">
            <Loader2 size={18} className="animate-spin text-[#315D40]" />
            Verifying active administrator profile…
          </div>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  if (access === "denied") {
    return (
      <DemoModulePage
        title="Access restricted"
        description="Inspection Test Mode is available only to authenticated administrators."
        icon={ShieldAlert}
        modeLabel="ADMIN ONLY"
        notice="No vehicles or checklist records were loaded."
      >
        <DemoPanel title="Administrator access required">
          <p className="text-sm leading-6 text-[#697267]" role="alert">
            Your active workshop profile does not have the admin role. Test
            Mode data and controls are unavailable to this account.
          </p>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  if (access === "error") {
    return (
      <DemoModulePage
        title="Inspection Test Mode"
        description="Test Mode could not verify access or load its read-only source data."
        icon={TestTube2}
        modeLabel="TEST MODE"
        notice="No inspection records or evidence were created."
      >
        <DemoPanel title="Test Mode unavailable">
          <p className="rounded-xl border border-[#EBC4BA] bg-[#FCE9E5] p-4 text-sm text-[#9F4A3A]" role="alert">
            {errorMessage}
          </p>
        </DemoPanel>
      </DemoModulePage>
    );
  }

  const currentSection = checklist?.sections.find(
    (section) => section.section_no === selectedSectionNo
  );
  const currentSectionProgress = summary?.sectionProgress.find(
    (progress) => progress.section.section_no === selectedSectionNo
  );

  return (
    <DemoModulePage
      title="Inspection Test Mode"
      description="Run a local simulation against all 260 master checkpoints using registered vehicle data. Only vehicle-applicable checkpoints are assessed; generated results and evidence are TEST DATA."
      icon={TestTube2}
      modeLabel="TEST MODE"
      notice={`Administrator · ${actor?.profile.full_name ?? "Active admin"}. Simulation results are saved only in browser localStorage; no inspection workflow records are written.`}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-[#E9D1A8] bg-[#FFF6E9] p-4 text-xs leading-5 text-[#80643A]">
        <AlertTriangle size={17} className="mt-0.5 shrink-0" />
        <p>
          <strong>TEST DATA ONLY.</strong> Sample assessments, safety outcomes,
          and evidence below are synthetic. Test Mode reads registered
          vehicles and the checklist but never calls inspection submission,
          Storage uploads, or write RPCs.
        </p>
      </div>

      <DemoPanel
        title="Simulation setup"
        description="Choose a registered vehicle. Vehicle type filters the list and is always taken from that vehicle’s database record."
      >
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_auto_auto] md:items-end">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-[#697267]">
              Vehicle type
            </span>
            <select
              value={vehicleTypeFilter}
              onChange={(event) =>
                chooseVehicleType(
                  event.target.value as "all" | "motorcycle" | "scooter"
                )
              }
              className="w-full rounded-xl border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-3 text-sm text-[#344337] outline-none focus:border-[#63866B]"
            >
              <option value="all">All vehicle types</option>
              <option value="motorcycle">Motorcycles</option>
              <option value="scooter">Scooters</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-[#697267]">
              Registered vehicle
            </span>
            <select
              value={selectedVehicle?.id ?? ""}
              onChange={(event) => chooseVehicle(event.target.value)}
              disabled={filteredVehicles.length === 0}
              className="w-full rounded-xl border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-3 text-sm text-[#344337] outline-none focus:border-[#63866B] disabled:opacity-50"
            >
              {filteredVehicles.length === 0 ? (
                <option value="">No registered vehicles available</option>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.make} {vehicle.model} ·{" "}
                    {vehicle.registration_number}
                  </option>
                ))
              )}
            </select>
            {selectedVehicle && (
              <span className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-[#315D40]">
                {selectedVehicle.vehicle_type} · Supabase vehicle record
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={generateTestData}
            disabled={!selectedVehicle || !checklist}
            className={demoButtonClass}
          >
            <TestTube2 size={15} /> Generate test assessments
          </button>
          <button
            type="button"
            onClick={resetSimulation}
            disabled={!simulation}
            className={demoSubtleButtonClass}
          >
            <RotateCcw size={14} /> Clear test run
          </button>
        </div>
        {vehicles.length === 0 && (
          <p className="mt-4 rounded-xl bg-[#FCFBF7] p-3 text-xs text-[#697267]">
            No registered vehicles are visible to this admin account. Test
            Mode does not create sample vehicles.
          </p>
        )}
      </DemoPanel>

      {summary && simulation && selectedVehicle && checklist && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <DemoMetricCard
              label="Applicable"
              value={summary.totalApplicable}
              detail={`${summary.activeCheckpointCount} vehicle-type checkpoints`}
              icon={ClipboardCheck}
            />
            <DemoMetricCard
              label="Completed"
              value={summary.completed}
              detail="Assessment and required test evidence complete"
              icon={CheckCircle2}
              accent="green"
            />
            <DemoMetricCard
              label="Pending"
              value={summary.pending}
              detail="Applicable checkpoints not complete"
              icon={RotateCcw}
              accent="amber"
            />
            <DemoMetricCard
              label="Unresolved"
              value={summary.unresolved}
              detail={`${summary.notApplicable} conditional checks marked N/A`}
              icon={AlertTriangle}
              accent="orange"
            />
            <DemoMetricCard
              label="Missing evidence"
              value={summary.missingEvidence.length}
              detail="Required test media missing from assessed checks"
              icon={FileImage}
              accent="orange"
            />
          </section>

          <DemoPanel
            title="Section completion"
            description="All 22 master sections are shown. Vehicle-type-inapplicable checkpoints are excluded; unresolved conditionals are listed separately."
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {summary.sectionProgress.map((progress) => (
                <button
                  type="button"
                  key={progress.section.section_no}
                  onClick={() =>
                    setSelectedSectionNo(progress.section.section_no)
                  }
                  aria-current={
                    selectedSectionNo === progress.section.section_no
                      ? "step"
                      : undefined
                  }
                  className={`rounded-xl border p-3 text-left transition ${
                    selectedSectionNo === progress.section.section_no
                      ? "border-[#315D40] bg-[#F0F4ED]"
                      : "border-[#E8E4D9] bg-[#FCFBF7] hover:border-[#B8C6B8]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#344337]">
                      Section {sourceSectionLabels[progress.section.section_no]}{" "}
                      · {progress.section.name}
                    </span>
                    <span className="shrink-0 text-[10px] font-extrabold text-[#315D40]">
                      {progress.percentage}%
                    </span>
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#E8E8DE]">
                    <span
                      className="block h-full rounded-full bg-[#315D40]"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </span>
                  <span className="mt-2 block text-[9px] text-[#92958A]">
                    {progress.totalApplicable === 0
                      ? "No applicable checkpoints"
                      : `${progress.completed}/${progress.totalApplicable} complete`}
                    {progress.unresolved > 0
                      ? ` · ${progress.unresolved} unresolved`
                      : ""}
                    {progress.notApplicable > 0
                      ? ` · ${progress.notApplicable} N/A`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          </DemoPanel>

          <DemoPanel
            title={
              currentSection
                ? `Section ${sourceSectionLabels[currentSection.section_no]} · ${currentSection.name}`
                : "Checkpoint assessments"
            }
            description={`${currentSectionProgress?.completed ?? 0} of ${currentSectionProgress?.totalApplicable ?? 0} applicable checkpoints complete. Each displayed assessment and evidence item is synthetic TEST DATA.`}
          >
            {visibleCheckpoints.length === 0 ? (
              <p className="rounded-xl bg-[#FCFBF7] p-4 text-xs text-[#697267]">
                This section has no checkpoints applicable to the selected
                vehicle type.
              </p>
            ) : (
              <div className="space-y-3">
                {visibleCheckpoints.map((checkpoint) => {
                  const key = String(checkpoint.checkpoint_no);
                  const assessment = simulation.assessments[key];
                  const applicable = checkpoint.is_conditional
                    ? simulation.applicability[key]
                    : true;
                  const evidence = simulation.evidence[key] ?? [];
                  const failed =
                    !!assessment && isCriticalFailure(checkpoint, assessment);
                  const complete = isCheckpointAssessmentComplete(
                    checkpoint,
                    simulation,
                    key
                  );
                  const testMedia = getRequiredSimulationMedia(checkpoint);

                  return (
                    <article
                      key={checkpoint.checkpoint_no}
                      className={`rounded-2xl border p-4 ${
                        failed
                          ? "border-[#EBC4BA] bg-[#FFFBFA]"
                          : "border-[#E8E4D9] bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#F3F0E7] px-2 text-xs font-extrabold text-[#315D40]">
                            {checkpoint.checkpoint_no}
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-[#26332A]">
                              {checkpoint.name}
                            </h3>
                            <p className="mt-1 text-[10px] text-[#92958A]">
                              {checkpoint.classification} ·{" "}
                              {checkpoint.assessment_method}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold tracking-wide ${
                            failed
                              ? "bg-[#FCE9E5] text-[#B44936]"
                              : complete
                                ? "bg-[#E7F4E6] text-[#26804B]"
                                : "bg-[#FFF3E4] text-[#A36B22]"
                          }`}
                        >
                          {failed
                            ? "SIMULATED CRITICAL FAILURE"
                            : complete
                              ? "TEST DATA COMPLETE"
                              : "PENDING TEST DATA"}
                        </span>
                      </div>

                      {checkpoint.is_conditional && (
                        <label className="mt-4 block max-w-sm">
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#697267]">
                            Simulated applicability
                          </span>
                          <select
                            value={
                              applicable === true
                                ? "yes"
                                : applicable === false
                                  ? "no"
                                  : ""
                            }
                            onChange={(event) =>
                              changeApplicability(checkpoint, event.target.value)
                            }
                            className="w-full rounded-xl border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-2.5 text-xs text-[#344337]"
                          >
                            <option value="">Unresolved</option>
                            <option value="yes">Applicable — simulate check</option>
                            <option value="no">Not applicable — test decision</option>
                          </select>
                        </label>
                      )}

                      {applicable === null ? (
                        <p className="mt-3 text-xs font-semibold text-[#A36B22]">
                          Resolve this conditional test decision before the
                          submission preview can qualify.
                        </p>
                      ) : applicable === false ? (
                        <p className="mt-3 rounded-lg bg-[#F3F4ED] p-3 text-[10px] text-[#697267]">
                          Marked not applicable in this local test run. This is
                          not an equipment record or an authorized live
                          inspection decision.
                        </p>
                      ) : assessment ? (
                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.75fr)]">
                          <div className="rounded-xl bg-[#F7F6F1] p-3">
                            <p className="text-[9px] font-extrabold uppercase tracking-wide text-[#315D40]">
                              Simulated assessment · TEST DATA
                            </p>
                            <dl className="mt-2 grid gap-x-4 gap-y-2 text-[10px] sm:grid-cols-2">
                              {assessment.resultStatus && (
                                <TestValue
                                  label="Result"
                                  value={assessment.resultStatus.replace("_", " ")}
                                />
                              )}
                              {assessment.cosmeticScore !== null && (
                                <TestValue
                                  label="Cosmetic score"
                                  value={`${assessment.cosmeticScore} / 5`}
                                />
                              )}
                              {assessment.measuredValue && (
                                <TestValue
                                  label="Measured"
                                  value={`${assessment.measuredValue} ${assessment.measuredUnit}`}
                                />
                              )}
                              {assessment.expectedValue && (
                                <TestValue
                                  label="Test reference"
                                  value={assessment.expectedValue}
                                />
                              )}
                              {assessment.recordedValue && (
                                <TestValue
                                  label="Recorded value"
                                  value={assessment.recordedValue}
                                />
                              )}
                              {assessment.matchStatus && (
                                <TestValue
                                  label="Match check"
                                  value={assessment.matchStatus}
                                />
                              )}
                              {assessment.countValue && (
                                <TestValue
                                  label="Count"
                                  value={assessment.countValue}
                                />
                              )}
                              {assessment.isDisclosed !== null && (
                                <TestValue
                                  label="Disclosure"
                                  value={
                                    assessment.isDisclosed
                                      ? "Disclosed"
                                      : "Undisclosed"
                                  }
                                />
                              )}
                              {simulation.autoValues[key] && (
                                <TestValue
                                  label="Automatic value"
                                  value={simulation.autoValues[key]}
                                />
                              )}
                            </dl>
                          </div>

                          <div className="rounded-xl border border-dashed border-[#D8DCCF] bg-[#FCFBF7] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[9px] font-extrabold uppercase tracking-wide text-[#697267]">
                                Evidence · {checkpoint.evidence_required}
                              </p>
                              <span className="rounded-full bg-[#FFF0E0] px-2 py-1 text-[8px] font-extrabold text-[#B66A2B]">
                                TEST DATA
                              </span>
                            </div>
                            {testMedia.length === 0 ? (
                              <p className="mt-3 text-[10px] text-[#92958A]">
                                No evidence media required.
                              </p>
                            ) : evidence.length === 0 ? (
                              <p className="mt-3 text-[10px] font-semibold text-[#A95719]">
                                Missing simulated{" "}
                                {testMedia.map((media) => media).join(" and ")}.
                              </p>
                            ) : (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {evidence.map((item) => {
                                  const MediaIcon =
                                    item.mediaType === "photo" ? FileImage : Film;
                                  return (
                                    <span
                                      key={item.id}
                                      className="inline-flex items-center gap-2 rounded-lg bg-[#F0F4ED] px-2.5 py-2 text-[9px] font-semibold text-[#315D40]"
                                    >
                                      <MediaIcon size={13} />
                                      {item.label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {evidence.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  removeTestEvidence(checkpoint.checkpoint_no)
                                }
                                className="mt-3 text-[9px] font-bold text-[#A95719] underline"
                              >
                                Remove test evidence to preview a missing-evidence case
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-[#A36B22]">
                          No assessment generated for this checkpoint.
                        </p>
                      )}

                      {assessment && applicable !== false && (
                        <button
                          type="button"
                          onClick={() => clearCheckpoint(checkpoint.checkpoint_no)}
                          className="mt-3 text-[9px] font-semibold text-[#697267] underline"
                        >
                          Clear this test assessment
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </DemoPanel>

          <DemoPanel
            title="Simulated safety and submission preview"
            description="Submission preview runs only local validation. It does not call submit_inspection or create any Supabase inspection, result, evidence, rating, repair, or QC records."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold ${
                  summary.safetyStatus === "CLEARED"
                    ? "bg-[#E7F4E6] text-[#26804B]"
                    : summary.safetyStatus === "BLOCKED"
                      ? "bg-[#FCE9E5] text-[#B44936]"
                      : "bg-[#FFF3E4] text-[#A36B22]"
                }`}
              >
                {summary.safetyStatus === "CLEARED" ? (
                  <ShieldCheck size={17} />
                ) : summary.safetyStatus === "BLOCKED" ? (
                  <XCircle size={17} />
                ) : (
                  <ShieldAlert size={17} />
                )}
                SIMULATED SAFETY: {summary.safetyStatus}
              </div>
              <button
                type="button"
                onClick={simulateSubmission}
                className={demoButtonClass}
              >
                <ClipboardCheck size={15} /> Simulate Submission
              </button>
            </div>

            {submissionErrors.length > 0 && (
              <div
                className="mt-4 rounded-xl border border-[#EBC4BA] bg-[#FCE9E5] p-4 text-xs text-[#9F4A3A]"
                role="alert"
              >
                <h3 className="font-bold">
                  Simulation was not saved or submitted
                </h3>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {submissionErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.criticalFailures.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#EBC4BA] bg-[#FCE9E5] p-4">
                <h3 className="text-xs font-bold text-[#9F4A3A]">
                  Simulated critical failures ({summary.criticalFailures.length})
                </h3>
                <ul className="mt-2 space-y-1 text-[10px] text-[#9F4A3A]">
                  {summary.criticalFailures.map((checkpoint) => (
                    <li key={checkpoint.checkpoint_no}>
                      #{checkpoint.checkpoint_no} · {checkpoint.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.missingEvidence.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#E9D1A8] bg-[#FFF6E9] p-4">
                <h3 className="text-xs font-bold text-[#80643A]">
                  Required simulated evidence missing
                </h3>
                <ul className="mt-2 space-y-1 text-[10px] text-[#80643A]">
                  {summary.missingEvidence.map(({ checkpoint, missingMedia }) => (
                    <li key={checkpoint.checkpoint_no}>
                      #{checkpoint.checkpoint_no} · {checkpoint.name}:{" "}
                      {missingMedia.join(" and ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {submissionPreviewRequested && (
              <div
                className={`mt-4 rounded-xl border p-4 ${
                  summary.submissionEligible
                    ? "border-[#C9DFC9] bg-[#F0F7EF]"
                    : "border-[#E9D1A8] bg-[#FFF6E9]"
                }`}
                role="status"
              >
                <h3
                  className={`text-sm font-bold ${
                    summary.submissionEligible
                      ? "text-[#28543D]"
                      : "text-[#80643A]"
                  }`}
                >
                  {summary.submissionEligible
                    ? "Simulation would qualify for submission"
                    : "Simulation is not eligible for submission"}
                </h3>
                <p className="mt-2 text-xs leading-5 text-[#697267]">
                  {summary.pending} pending applicable checkpoints ·{" "}
                  {summary.unresolved} unresolved conditional decisions ·{" "}
                  {summary.missingEvidence.length} checkpoints missing required
                  evidence.
                  {summary.criticalFailures.length > 0
                    ? ` ${summary.criticalFailures.length} critical failures still block simulated safety clearance; they do not get hidden by this submission preview.`
                    : ""}
                </p>
              </div>
            )}
          </DemoPanel>
        </>
      )}

      {access === "admin" && checklist && !selectedVehicle && (
        <DemoPanel title="Select a registered vehicle">
          <p className="text-sm text-[#697267]">
            Choose a registered vehicle to generate a local test run. No
            vehicles will be created by Test Mode.
          </p>
        </DemoPanel>
      )}

      {simulation && !summary && (
        <p className="text-xs text-[#92958A]" role="status">
          Select a registered vehicle to continue the test run.
        </p>
      )}
    </DemoModulePage>
  );
}

function TestValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[8px] font-bold uppercase tracking-wide text-[#92958A]">
        {label} · TEST DATA
      </dt>
      <dd className="mt-0.5 break-words font-semibold text-[#344337]">
        {value}
      </dd>
    </div>
  );
}
