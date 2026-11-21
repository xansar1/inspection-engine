import { z } from "zod";

const checkpointSchema = z.object({
  checkpoint_no: z.number().int().min(1).max(260),
  section_no: z.number().int().min(1).max(22),
  section_name: z.string(),
  name: z.string(),
  classification: z.enum(["Critical", "Cosmetic", "Data", "Mixed"]),
  assessment_method: z.string(),
  evidence_required: z.enum(["Photo", "Video", "Photo+Video", "Not required"]),
  active_for: z.enum(["both", "motorcycle", "scooter"]),
  is_conditional: z.boolean(),
});

const sectionSchema = z.object({
  section_no: z.number().int().min(1).max(22),
  name: z.string(),
});

const checklistSchema = z.object({
  sections: z.array(sectionSchema),
  checkpoints: z.array(checkpointSchema),
});

export type InspectionChecklistData = z.infer<typeof checklistSchema>;

export function parseInspectionChecklist(
  value: unknown
): InspectionChecklistData {
  const checklist = checklistSchema.parse(value);

  if (
    checklist.sections.length !== 22 ||
    checklist.sections.some(
      (section, index) => section.section_no !== index + 1
    )
  ) {
    throw new Error(
      `Supabase returned ${checklist.sections.length} sections; expected 22 ordered sections.`
    );
  }

  if (
    checklist.checkpoints.length !== 260 ||
    checklist.checkpoints.some(
      (checkpoint, index) => checkpoint.checkpoint_no !== index + 1
    )
  ) {
    throw new Error(
      `Supabase returned ${checklist.checkpoints.length} active checkpoints; expected the ordered 1–260 set.`
    );
  }

  const sectionsByNumber = new Map(
    checklist.sections.map((section) => [section.section_no, section.name])
  );
  if (
    checklist.checkpoints.some(
      (checkpoint) =>
        sectionsByNumber.get(checkpoint.section_no) !== checkpoint.section_name
    )
  ) {
    throw new Error(
      "A Supabase checkpoint references an unknown or mismatched section."
    );
  }

  const fuelLidLock = checklist.checkpoints.find(
    (checkpoint) => checkpoint.checkpoint_no === 115
  );
  const tankShrouds = checklist.checkpoints.find(
    (checkpoint) => checkpoint.checkpoint_no === 125
  );
  if (fuelLidLock?.active_for !== "scooter") {
    throw new Error("Supabase checkpoint 115 must be scooter-only.");
  }
  if (tankShrouds?.active_for !== "motorcycle") {
    throw new Error("Supabase checkpoint 125 must be motorcycle-only.");
  }

  const applicabilityCounts = {
    motorcycle: { applicable: 250, unresolved: 4 },
    scooter: { applicable: 243, unresolved: 5 },
  };
  for (const vehicleType of ["motorcycle", "scooter"] as const) {
    const active = checklist.checkpoints.filter(
      (checkpoint) =>
        checkpoint.active_for === "both" ||
        checkpoint.active_for === vehicleType
    );
    const applicable = active.filter(
      (checkpoint) => !checkpoint.is_conditional
    ).length;
    const unresolved = active.filter(
      (checkpoint) => checkpoint.is_conditional
    ).length;
    const expected = applicabilityCounts[vehicleType];
    if (
      applicable !== expected.applicable ||
      unresolved !== expected.unresolved
    ) {
      throw new Error(
        `Supabase checklist applicability is invalid for ${vehicleType}: expected ${expected.applicable} applicable and ${expected.unresolved} unresolved conditional checkpoints; received ${applicable} and ${unresolved}.`
      );
    }
  }

  return checklist;
}

export const sourceSectionLabels: Record<number, string> = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "11",
  12: "12",
  13: "13",
  14: "14",
  15: "14b",
  16: "15",
  17: "16",
  18: "17",
  19: "18",
  20: "19",
  21: "20",
  22: "21",
};

const assessmentSchema = z.object({
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
  observation: z.string().default(""),
  applicabilityReason: z.string().default(""),
  evidenceDue: z.boolean().default(false),
});

export type InspectionCheckpoint = z.infer<typeof checkpointSchema>;
export type InspectionSection = z.infer<typeof sectionSchema>;
export type CheckpointAssessment = z.infer<typeof assessmentSchema>;

export const inspectionSessionSchema = z.object({
  startedAt: z.string().nullable(),
  selectedMechanic: z.string(),
  applicability: z.record(z.string(), z.boolean().nullable()),
  assessments: z.record(z.string(), assessmentSchema),
});

export type InspectionSessionState = z.infer<typeof inspectionSessionSchema>;

export function createEmptyAssessment(): CheckpointAssessment {
  return {
    resultStatus: null,
    cosmeticScore: null,
    measuredValue: "",
    measuredUnit: "",
    expectedValue: "",
    recordedValue: "",
    matchStatus: null,
    isDisclosed: null,
    countValue: "",
    issueDescription: "",
    observation: "",
    applicabilityReason: "",
    evidenceDue: false,
  };
}

export function createEmptyInspectionSession(): InspectionSessionState {
  return {
    startedAt: null,
    selectedMechanic: "",
    applicability: {},
    assessments: {},
  };
}

function isValidNumber(value: string) {
  return value.trim() !== "" && Number.isFinite(Number(value));
}

function isPassOrFail(status: CheckpointAssessment["resultStatus"]) {
  return status === "pass" || status === "fail";
}

export function isAssessmentStarted(
  checkpoint: InspectionCheckpoint,
  assessment: CheckpointAssessment,
  applicable: boolean | null | undefined,
  autoValue: string
) {
  if (checkpoint.is_conditional && applicable !== true) return false;
  const method = checkpoint.assessment_method;
  if (method.startsWith("Auto-")) return autoValue.trim() !== "";
  if (method.startsWith("1–5 scale")) {
    return (
      assessment.cosmeticScore !== null ||
      (method.includes("Pass/Fail") && isPassOrFail(assessment.resultStatus))
    );
  }
  if (method === "Measured") {
    return (
      assessment.measuredValue.trim() !== "" ||
      assessment.measuredUnit.trim() !== ""
    );
  }
  if (
    method === "Measured vs spec" ||
    method === "Age vs threshold" ||
    method === "Pass/Fail (wear threshold)"
  ) {
    return (
      assessment.measuredValue.trim() !== "" ||
      assessment.measuredUnit.trim() !== "" ||
      assessment.expectedValue.trim() !== "" ||
      isPassOrFail(assessment.resultStatus)
    );
  }
  if (method === "Recorded") {
    return assessment.recordedValue.trim() !== "";
  }
  if (method === "Disclosed / Undisclosed") {
    return assessment.isDisclosed !== null;
  }
  if (method === "Present/Absent") {
    return (
      assessment.recordedValue === "Present" ||
      assessment.recordedValue === "Absent"
    );
  }
  if (method === "Match + tamper check") {
    return (
      assessment.matchStatus !== null ||
      isPassOrFail(assessment.resultStatus)
    );
  }
  if (method.includes("Match")) return assessment.matchStatus !== null;
  if (method.includes("count logged")) {
    return (
      assessment.countValue.trim() !== "" ||
      isPassOrFail(assessment.resultStatus)
    );
  }
  if (method.includes("Pass/Fail") || method === "Tamper check") {
    return isPassOrFail(assessment.resultStatus);
  }
  return false;
}

export function isAssessmentComplete(
  checkpoint: InspectionCheckpoint,
  assessment: CheckpointAssessment,
  applicable: boolean | null | undefined,
  autoValue: string
) {
  if (checkpoint.is_conditional) {
    if (applicable === false) {
      return assessment.resultStatus === "not_applicable";
    }
    if (applicable !== true) return false;
  }

  const method = checkpoint.assessment_method;

  if (method.startsWith("1–5 scale +")) {
    return assessment.cosmeticScore !== null && isPassOrFail(assessment.resultStatus);
  }
  if (method.startsWith("1–5 scale")) {
    return assessment.cosmeticScore !== null;
  }
  if (
    method === "Measured vs spec" ||
    method === "Age vs threshold" ||
    method === "Pass/Fail (wear threshold)"
  ) {
    return (
      isValidNumber(assessment.measuredValue) &&
      assessment.measuredUnit.trim() !== "" &&
      assessment.expectedValue.trim() !== "" &&
      isPassOrFail(assessment.resultStatus)
    );
  }
  if (method === "Measured") {
    return (
      isValidNumber(assessment.measuredValue) &&
      assessment.measuredUnit.trim() !== ""
    );
  }
  if (method === "Recorded") {
    return assessment.recordedValue.trim() !== "";
  }
  if (method === "Disclosed / Undisclosed") {
    return assessment.isDisclosed !== null;
  }
  if (method === "Present/Absent") {
    return (
      assessment.recordedValue === "Present" ||
      assessment.recordedValue === "Absent"
    );
  }
  if (method === "Match + tamper check") {
    return assessment.matchStatus !== null && isPassOrFail(assessment.resultStatus);
  }
  if (method.includes("Match")) {
    return assessment.matchStatus !== null;
  }
  if (method.includes("count logged")) {
    return (
      isPassOrFail(assessment.resultStatus) &&
      isValidNumber(assessment.countValue) &&
      Number(assessment.countValue) >= 0
    );
  }
  if (method.includes("Pass/Fail") || method === "Tamper check") {
    return isPassOrFail(assessment.resultStatus);
  }
  if (method.startsWith("Auto-")) {
    return autoValue.trim() !== "";
  }

  return assessment.recordedValue.trim() !== "";
}

export function isCriticalFailure(
  checkpoint: InspectionCheckpoint,
  assessment: CheckpointAssessment
) {
  if (
    checkpoint.classification !== "Critical" &&
    checkpoint.classification !== "Mixed"
  ) {
    return false;
  }

  return (
    assessment.resultStatus === "fail" ||
    assessment.matchStatus === "mismatch" ||
    (checkpoint.assessment_method === "Present/Absent" &&
      assessment.recordedValue === "Absent")
  );
}

export function hasRequiredEvidence(
  requirement: InspectionCheckpoint["evidence_required"],
  evidence: Array<{ mediaType: "photo" | "video" }>
) {
  if (requirement === "Not required") return true;
  const hasPhoto = evidence.some((item) => item.mediaType === "photo");
  const hasVideo = evidence.some((item) => item.mediaType === "video");
  if (requirement === "Photo") return hasPhoto;
  if (requirement === "Video") return hasVideo;
  return hasPhoto && hasVideo;
}
