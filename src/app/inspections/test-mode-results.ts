import { z } from "zod";
import {
  createEmptyAssessment,
  hasRequiredEvidence,
  isAssessmentComplete,
  isAssessmentStarted,
  isCriticalFailure,
  type InspectionCheckpoint,
} from "./checklist-model.ts";
import { filterCheckpointsForVehicle } from "./vehicle-applicability.ts";
import {
  getRequiredSimulationMedia,
  type InspectionSimulation,
  type InspectionSimulationSummary,
  type SimulationVehicle,
} from "./test-mode-model.ts";

export const TEST_MODE_RESULTS_STORAGE_KEY = "inspection_test_mode_results";

const checkpointResultSchema = z.object({
  checkpointNo: z.number().int().min(1).max(260),
  sectionNo: z.number().int().min(1).max(22),
  sectionName: z.string(),
  name: z.string(),
  classification: z.enum(["Critical", "Cosmetic", "Data", "Mixed"]),
  assessmentMethod: z.string(),
  evidenceRequired: z.enum(["Photo", "Video", "Photo+Video", "Not required"]),
  applicable: z.boolean().nullable(),
  status: z.enum(["completed", "pending", "not_applicable", "unresolved"]),
  criticalFailure: z.boolean(),
  assessment: z.object({
    resultStatus: z
      .enum(["pass", "fail", "not_applicable", "recorded"])
      .nullable(),
    cosmeticScore: z.number().int().min(1).max(5).nullable(),
    measuredValue: z.string(),
    measuredUnit: z.string(),
    expectedValue: z.string(),
    recordedValue: z.string(),
    matchStatus: z.enum(["match", "mismatch"]).nullable(),
    isDisclosed: z.boolean().nullable(),
    countValue: z.string(),
    issueDescription: z.string(),
    observation: z.string(),
  }),
  autoValue: z.string(),
  evidence: z.array(
    z.object({
      mediaType: z.enum(["photo", "video"]),
      label: z.string().refine((value) => value.includes("TEST DATA")),
    })
  ),
});

const testModeResultSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  simulatedAt: z.string().datetime(),
  vehicleId: z.string().min(1),
  registrationNumber: z.string().min(1),
  vehicleType: z.enum(["motorcycle", "scooter"]),
  counts: z.object({
    applicable: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    unresolved: z.number().int().nonnegative(),
    notApplicable: z.number().int().nonnegative(),
  }),
  evidenceStatus: z.object({
    requiredMediaCount: z.number().int().nonnegative(),
    simulatedMediaCount: z.number().int().nonnegative(),
    missingMediaCount: z.number().int().nonnegative(),
    missingCheckpointNos: z.array(z.number().int().min(1).max(260)),
  }),
  criticalFailures: z.array(
    z.object({
      checkpointNo: z.number().int().min(1).max(260),
      sectionNo: z.number().int().min(1).max(22),
      name: z.string(),
    })
  ),
  safetyStatus: z.enum(["INCOMPLETE", "BLOCKED", "CLEARED"]),
  submissionEligible: z.literal(true),
  checkpoints: z.array(checkpointResultSchema),
});

export type TestModeCheckpointResult = z.infer<
  typeof checkpointResultSchema
>;
export type TestModeResult = z.infer<typeof testModeResultSchema>;
export type TestModeStorage = Pick<Storage, "getItem" | "setItem">;

function getBrowserStorage(): TestModeStorage {
  if (typeof window === "undefined") {
    throw new Error("Test Mode results are available only in a browser.");
  }
  try {
    return window.localStorage;
  } catch {
    throw new Error(
      "Browser localStorage is unavailable. The Test Mode result was not saved."
    );
  }
}

function readStorage(storage: TestModeStorage) {
  try {
    return storage.getItem(TEST_MODE_RESULTS_STORAGE_KEY);
  } catch {
    throw new Error(
      "Browser localStorage could not be read. The Test Mode result was not used."
    );
  }
}

function writeStorage(storage: TestModeStorage, value: string) {
  try {
    storage.setItem(TEST_MODE_RESULTS_STORAGE_KEY, value);
  } catch {
    throw new Error(
      "Browser localStorage could not save the Test Mode result. No navigation occurred."
    );
  }
}

export function readTestModeResults(
  storage: TestModeStorage = getBrowserStorage()
): TestModeResult[] {
  const raw = readStorage(storage);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "Stored Test Mode results are corrupted. No result was treated as real inspection data."
    );
  }

  const validated = z.array(testModeResultSchema).safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      "Stored Test Mode results have an invalid format. No result was treated as real inspection data."
    );
  }
  return validated.data;
}

export function saveTestModeResult(
  result: TestModeResult,
  storage: TestModeStorage = getBrowserStorage()
): TestModeResult[] {
  const validated = testModeResultSchema.parse(result);
  const current = readTestModeResults(storage);
  if (current.some((item) => item.id === validated.id)) {
    throw new Error("This Test Mode run already exists and was not overwritten.");
  }
  const updated = [validated, ...current];
  writeStorage(storage, JSON.stringify(updated));
  return updated;
}

export function getTestModeResultsForVehicle(
  vehicleId: string,
  storage: TestModeStorage = getBrowserStorage()
): TestModeResult[] {
  return readTestModeResults(storage)
    .filter((result) => result.vehicleId === vehicleId)
    .sort(
      (left, right) =>
        Date.parse(right.simulatedAt) - Date.parse(left.simulatedAt)
    );
}

export function getLatestTestModeResultForVehicle(
  vehicleId: string,
  storage: TestModeStorage = getBrowserStorage()
): TestModeResult | null {
  return getTestModeResultsForVehicle(vehicleId, storage)[0] ?? null;
}

export function createTestModeResult(
  id: string,
  simulatedAt: string,
  vehicle: SimulationVehicle,
  checkpoints: readonly InspectionCheckpoint[],
  simulation: InspectionSimulation,
  summary: InspectionSimulationSummary
): TestModeResult {
  const activeCheckpoints = filterCheckpointsForVehicle(
    checkpoints,
    vehicle.vehicle_type
  );
  let requiredMediaCount = 0;
  let simulatedMediaCount = 0;

  const checkpointResults = activeCheckpoints.map((checkpoint) => {
    const key = String(checkpoint.checkpoint_no);
    const applicable = checkpoint.is_conditional
      ? simulation.applicability[key] ?? null
      : true;
    const assessment =
      simulation.assessments[key] ?? createEmptyAssessment();
    const autoValue = simulation.autoValues[key] ?? "";
    const evidence = simulation.evidence[key] ?? [];
    const notApplicable = checkpoint.is_conditional && applicable === false;
    const assessmentComplete = isAssessmentComplete(
      checkpoint,
      assessment,
      applicable,
      autoValue
    );
    const evidenceDue =
      !notApplicable &&
      checkpoint.evidence_required !== "Not required" &&
      (isAssessmentStarted(checkpoint, assessment, applicable, autoValue) ||
        assessment.evidenceDue);
    const requiredMedia = evidenceDue
      ? getRequiredSimulationMedia(checkpoint)
      : [];
    const availableMedia = new Set(evidence.map((item) => item.mediaType));
    requiredMediaCount += requiredMedia.length;
    simulatedMediaCount += requiredMedia.filter((mediaType) =>
      availableMedia.has(mediaType)
    ).length;
    const complete =
      assessmentComplete &&
      (notApplicable ||
        hasRequiredEvidence(checkpoint.evidence_required, evidence));
    const status = notApplicable
      ? "not_applicable"
      : checkpoint.is_conditional && applicable === null
        ? "unresolved"
        : complete
          ? "completed"
          : "pending";

    return {
      checkpointNo: checkpoint.checkpoint_no,
      sectionNo: checkpoint.section_no,
      sectionName: checkpoint.section_name,
      name: checkpoint.name,
      classification: checkpoint.classification,
      assessmentMethod: checkpoint.assessment_method,
      evidenceRequired: checkpoint.evidence_required,
      applicable,
      status,
      criticalFailure:
        applicable !== false && isCriticalFailure(checkpoint, assessment),
      assessment: {
        resultStatus: assessment.resultStatus,
        cosmeticScore: assessment.cosmeticScore,
        measuredValue: assessment.measuredValue,
        measuredUnit: assessment.measuredUnit,
        expectedValue: assessment.expectedValue,
        recordedValue: assessment.recordedValue,
        matchStatus: assessment.matchStatus,
        isDisclosed: assessment.isDisclosed,
        countValue: assessment.countValue,
        issueDescription: assessment.issueDescription,
        observation: assessment.observation,
      },
      autoValue,
      evidence: evidence.map(({ mediaType, label }) => ({ mediaType, label })),
    };
  });

  return testModeResultSchema.parse({
    schemaVersion: 1,
    id,
    simulatedAt,
    vehicleId: vehicle.id,
    registrationNumber: vehicle.registration_number,
    vehicleType: vehicle.vehicle_type,
    counts: {
      applicable: summary.totalApplicable,
      completed: summary.completed,
      pending: summary.pending,
      unresolved: summary.unresolved,
      notApplicable: summary.notApplicable,
    },
    evidenceStatus: {
      requiredMediaCount,
      simulatedMediaCount,
      missingMediaCount: summary.missingEvidence.reduce(
        (total, item) => total + item.missingMedia.length,
        0
      ),
      missingCheckpointNos: summary.missingEvidence.map(
        (item) => item.checkpoint.checkpoint_no
      ),
    },
    criticalFailures: summary.criticalFailures.map((checkpoint) => ({
      checkpointNo: checkpoint.checkpoint_no,
      sectionNo: checkpoint.section_no,
      name: checkpoint.name,
    })),
    safetyStatus: summary.safetyStatus,
    submissionEligible: summary.submissionEligible,
    checkpoints: checkpointResults,
  });
}

export function getTestModeSubmissionErrors(
  summary: InspectionSimulationSummary
): string[] {
  const errors: string[] = [];
  if (summary.pending > 0) {
    errors.push(`${summary.pending} applicable checkpoints are still pending.`);
  }
  if (summary.unresolved > 0) {
    errors.push(
      `${summary.unresolved} conditional checkpoint decisions are unresolved.`
    );
  }
  if (summary.missingEvidence.length > 0) {
    errors.push(
      `${summary.missingEvidence.length} checkpoints are missing required simulated evidence.`
    );
  }
  if (!summary.submissionEligible && errors.length === 0) {
    errors.push("The simulation does not meet the existing submission checks.");
  }
  return errors;
}

export function submitTestModeSimulation(
  summary: InspectionSimulationSummary,
  result: TestModeResult,
  navigate: (path: "/dashboard") => void,
  storage?: TestModeStorage
): { success: boolean; errors: string[] } {
  const errors = getTestModeSubmissionErrors(summary);
  if (errors.length > 0) return { success: false, errors };

  saveTestModeResult(result, storage ?? getBrowserStorage());
  navigate("/dashboard");
  return { success: true, errors: [] };
}
