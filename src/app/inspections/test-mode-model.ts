import {
  createEmptyAssessment,
  hasRequiredEvidence,
  isAssessmentComplete,
  isAssessmentStarted,
  isCriticalFailure,
  type CheckpointAssessment,
  type InspectionCheckpoint,
  type InspectionSection,
} from "./checklist-model.ts";
import {
  filterCheckpointsForVehicle,
  type InspectionVehicleType,
} from "./vehicle-applicability.ts";

export type SimulationVehicle = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  registration_number: string;
  vehicle_type: InspectionVehicleType;
  fuel_type: string | null;
  engine_capacity: string | null;
  manufacturing_year: number | null;
  registration_year: number | null;
  colour: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  odometer_reading_km: number | null;
  owner_count: number | null;
  has_abs: boolean;
  has_parking_brake: boolean;
  has_catalytic_converter: boolean;
};

export type SimulatedEvidence = {
  id: string;
  mediaType: "photo" | "video";
  label: string;
};

export type InspectionSimulation = {
  applicability: Record<string, boolean | null>;
  assessments: Record<string, CheckpointAssessment>;
  autoValues: Record<string, string>;
  evidence: Record<string, SimulatedEvidence[]>;
};

export type MissingSimulationEvidence = {
  checkpoint: InspectionCheckpoint;
  missingMedia: Array<"photo" | "video">;
};

export type SimulationSectionProgress = {
  section: InspectionSection;
  completed: number;
  totalApplicable: number;
  unresolved: number;
  notApplicable: number;
  percentage: number;
};

export type InspectionSimulationSummary = {
  activeCheckpointCount: number;
  totalApplicable: number;
  completed: number;
  pending: number;
  unresolved: number;
  notApplicable: number;
  missingEvidence: MissingSimulationEvidence[];
  criticalFailures: InspectionCheckpoint[];
  sectionProgress: SimulationSectionProgress[];
  safetyStatus: "INCOMPLETE" | "BLOCKED" | "CLEARED";
  submissionEligible: boolean;
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sampleFailure(checkpoint: InspectionCheckpoint, seed: string) {
  return stableHash(`${seed}:${checkpoint.checkpoint_no}`) % 37 === 0;
}

function recordedVehicleValue(
  checkpoint: InspectionCheckpoint,
  vehicle: SimulationVehicle
) {
  const values: Record<number, string | number | null> = {
    1: vehicle.registration_number,
    2: vehicle.make,
    3: vehicle.model,
    4: vehicle.variant,
    5: vehicle.fuel_type,
    6: vehicle.engine_capacity,
    7: vehicle.manufacturing_year,
    8: vehicle.registration_year,
    9: vehicle.colour,
    10: vehicle.chassis_number,
    11: vehicle.engine_number,
    12: vehicle.odometer_reading_km,
    13: vehicle.owner_count,
    14: vehicle.vehicle_type,
  };
  const value = values[checkpoint.checkpoint_no];
  return value === null || value === undefined || value === ""
    ? `TEST DATA — ${checkpoint.name}`
    : String(value);
}

function simulatedAutoValue(
  checkpoint: InspectionCheckpoint,
  vehicle: SimulationVehicle,
  generatedAt: string
) {
  switch (checkpoint.checkpoint_no) {
    case 14:
      return `${vehicle.vehicle_type} — TEST DATA`;
    case 15:
      return `${generatedAt} — TEST DATA`;
    case 16:
    case 17:
      return "12.9716, 77.5946 — synthetic TEST DATA coordinates";
    case 18:
      return "Test mechanic — TEST DATA";
    case 19:
      return "00:15:00 — simulated duration";
    default:
      return `Auto-generated test value for checkpoint ${checkpoint.checkpoint_no}`;
  }
}

function measurementFor(
  checkpoint: InspectionCheckpoint,
  vehicle: SimulationVehicle,
  failed: boolean
): {
  measuredValue: string;
  measuredUnit: string;
  expectedValue: string;
  resultStatus: "pass" | "fail";
} {
  if (checkpoint.assessment_method === "Age vs threshold") {
    const age = vehicle.manufacturing_year
      ? new Date().getFullYear() - vehicle.manufacturing_year
      : 4;
    return {
      measuredValue: String(Math.max(age, 0)),
      measuredUnit: "years",
      expectedValue: "10 years maximum — TEST DATA",
      resultStatus: age > 10 ? "fail" as const : "pass" as const,
    };
  }

  const samples: Record<
    number,
    { pass: string; fail: string; unit: string; specification: string }
  > = {
    23: { pass: "4.8", fail: "1.2", unit: "mm", specification: "2.0 mm minimum" },
    24: { pass: "20", fail: "90", unit: "%", specification: "75% maximum wear" },
    31: { pass: "2.2", fail: "1.2", unit: "bar", specification: "2.0–2.5 bar test range" },
    40: { pass: "12", fail: "2", unit: "mm", specification: "10–20 mm test range" },
    43: { pass: "70", fail: "10", unit: "%", specification: "30% minimum" },
    50: { pass: "4.0", fail: "1.2", unit: "mm", specification: "2.0 mm minimum" },
    51: { pass: "4.5", fail: "3.0", unit: "mm", specification: "4.0 mm minimum" },
    97: { pass: "3", fail: "0.5", unit: "mm", specification: "2–6 mm test range" },
    147: { pass: "150", fail: "80", unit: "psi", specification: "120 psi minimum" },
    155: { pass: "70", fail: "10", unit: "%", specification: "30% minimum" },
    159: { pass: "70", fail: "10", unit: "%", specification: "30% minimum" },
    163: { pass: "10", fail: "1", unit: "mm", specification: "5–15 mm test range" },
    170: { pass: "4.0", fail: "1.0", unit: "mm", specification: "2.0 mm minimum" },
    178: { pass: "12.4", fail: "10.5", unit: "V", specification: "12.0 V minimum" },
    179: { pass: "14.2", fail: "11.0", unit: "V", specification: "13.5–14.8 V test range" },
    206: { pass: "4.0", fail: "1.2", unit: "mm", specification: "2.0 mm minimum" },
    208: { pass: "70", fail: "10", unit: "%", specification: "30% minimum" },
    214: { pass: "4.8", fail: "1.2", unit: "mm", specification: "2.0 mm minimum" },
    215: { pass: "20", fail: "90", unit: "%", specification: "75% maximum wear" },
    222: { pass: "2.2", fail: "1.2", unit: "bar", specification: "2.0–2.5 bar test range" },
    233: { pass: "85", fail: "85", unit: "km/h", specification: "Recorded during test — TEST DATA" },
  };
  const sample = samples[checkpoint.checkpoint_no];
  if (sample) {
    return {
      measuredValue: failed ? sample.fail : sample.pass,
      measuredUnit: sample.unit,
      expectedValue: `${sample.specification} — TEST DATA`,
      resultStatus: failed ? "fail" : "pass",
    };
  }

  return {
    measuredValue: failed ? "1.2" : "4.8",
    measuredUnit: "mm",
    expectedValue: "2.0 mm minimum — TEST DATA",
    resultStatus: failed ? "fail" : "pass",
  };
}

export function getSimulationApplicability(
  checkpoint: InspectionCheckpoint,
  vehicle: SimulationVehicle
): boolean | null {
  if (!checkpoint.is_conditional) return true;
  switch (checkpoint.checkpoint_no) {
    case 55:
      return vehicle.has_abs;
    case 115:
      return vehicle.vehicle_type === "scooter";
    case 198:
      return vehicle.has_catalytic_converter;
    case 210:
      return vehicle.has_parking_brake;
    case 256: {
      const registrationYear =
        vehicle.registration_year ?? vehicle.manufacturing_year;
      return registrationYear === null
        ? null
        : new Date().getFullYear() - registrationYear >= 1;
    }
    default:
      return null;
  }
}

export function generateSimulatedAssessment(
  checkpoint: InspectionCheckpoint,
  vehicle: SimulationVehicle,
  seed = vehicle.id,
  generatedAt = new Date().toISOString()
): { assessment: CheckpointAssessment; autoValue: string } {
  const assessment = createEmptyAssessment();
  const method = checkpoint.assessment_method;
  const failed = sampleFailure(checkpoint, seed);

  if (method.startsWith("Auto-")) {
    return {
      assessment,
      autoValue: simulatedAutoValue(checkpoint, vehicle, generatedAt),
    };
  }

  if (method.startsWith("1–5 scale")) {
    assessment.cosmeticScore = (stableHash(`${seed}:score:${checkpoint.checkpoint_no}`) % 5) + 1;
  }

  if (
    method === "Measured" ||
    method === "Measured vs spec" ||
    method === "Age vs threshold" ||
    method === "Pass/Fail (wear threshold)"
  ) {
    const measurement = measurementFor(checkpoint, vehicle, failed);
    assessment.measuredValue = measurement.measuredValue;
    assessment.measuredUnit = measurement.measuredUnit;
    if (method !== "Measured") {
      assessment.expectedValue = measurement.expectedValue;
      assessment.resultStatus = measurement.resultStatus;
    }
  }

  if (method.includes("Match")) {
    assessment.matchStatus = failed ? "mismatch" : "match";
    assessment.recordedValue = recordedVehicleValue(checkpoint, vehicle);
  }

  if (
    method.includes("Pass/Fail") ||
    method === "Tamper check" ||
    method === "Match + tamper check"
  ) {
    assessment.resultStatus = failed ? "fail" : "pass";
  }

  if (method.includes("count logged")) {
    assessment.countValue = failed ? "1" : "0";
  }

  if (method === "Present/Absent") {
    assessment.recordedValue = failed ? "Absent" : "Present";
    assessment.resultStatus =
      checkpoint.classification === "Critical"
        ? failed
          ? "fail"
          : "pass"
        : "recorded";
  }

  if (method === "Disclosed / Undisclosed") {
    assessment.isDisclosed = !failed;
    assessment.recordedValue = failed ? "Undisclosed" : "Disclosed";
  }

  if (method === "Recorded") {
    assessment.resultStatus = "recorded";
    assessment.recordedValue = recordedVehicleValue(checkpoint, vehicle);
  }

  if (
    !assessment.resultStatus &&
    !assessment.cosmeticScore &&
    !assessment.measuredValue &&
    !assessment.recordedValue &&
    !assessment.matchStatus &&
    assessment.isDisclosed === null
  ) {
    assessment.recordedValue = `Simulated ${checkpoint.name} result — TEST DATA`;
    assessment.resultStatus = "recorded";
  }

  return { assessment, autoValue: "" };
}

export function getRequiredSimulationMedia(
  checkpoint: InspectionCheckpoint
): Array<"photo" | "video"> {
  if (checkpoint.evidence_required === "Photo") return ["photo"];
  if (checkpoint.evidence_required === "Video") return ["video"];
  if (checkpoint.evidence_required === "Photo+Video") return ["photo", "video"];
  return [];
}

function generatedEvidence(checkpoint: InspectionCheckpoint): SimulatedEvidence[] {
  return getRequiredSimulationMedia(checkpoint).map((mediaType) => ({
    id: `test-${checkpoint.checkpoint_no}-${mediaType}`,
    mediaType,
    label: `SIMULATED ${mediaType.toUpperCase()} — TEST DATA`,
  }));
}

export function createInspectionSimulation(
  checkpoints: readonly InspectionCheckpoint[],
  vehicle: SimulationVehicle,
  seed = vehicle.id,
  generatedAt = new Date().toISOString()
): InspectionSimulation {
  const activeCheckpoints = filterCheckpointsForVehicle(
    checkpoints,
    vehicle.vehicle_type
  );
  const simulation: InspectionSimulation = {
    applicability: {},
    assessments: {},
    autoValues: {},
    evidence: {},
  };

  for (const checkpoint of activeCheckpoints) {
    const key = String(checkpoint.checkpoint_no);
    const applicable = getSimulationApplicability(checkpoint, vehicle);
    if (checkpoint.is_conditional) {
      simulation.applicability[key] = applicable;
    }
    if (applicable === null) continue;
    if (applicable === false) {
      simulation.assessments[key] = {
        ...createEmptyAssessment(),
        resultStatus: "not_applicable",
      };
      simulation.evidence[key] = [];
      continue;
    }

    const result = generateSimulatedAssessment(
      checkpoint,
      vehicle,
      seed,
      generatedAt
    );
    simulation.assessments[key] = result.assessment;
    simulation.autoValues[key] = result.autoValue;
    simulation.evidence[key] = generatedEvidence(checkpoint);
  }

  return simulation;
}

export function setSimulationApplicability(
  simulation: InspectionSimulation,
  checkpoint: InspectionCheckpoint,
  vehicle: SimulationVehicle,
  applicable: boolean | null,
  seed = vehicle.id
): InspectionSimulation {
  if (!checkpoint.is_conditional) return simulation;
  const key = String(checkpoint.checkpoint_no);
  const next: InspectionSimulation = {
    applicability: { ...simulation.applicability, [key]: applicable },
    assessments: { ...simulation.assessments },
    autoValues: { ...simulation.autoValues },
    evidence: { ...simulation.evidence },
  };

  if (applicable === null) {
    delete next.assessments[key];
    delete next.autoValues[key];
    delete next.evidence[key];
  } else if (applicable === false) {
    next.assessments[key] = {
      ...createEmptyAssessment(),
      resultStatus: "not_applicable",
    };
    next.autoValues[key] = "";
    next.evidence[key] = [];
  } else {
    const result = generateSimulatedAssessment(checkpoint, vehicle, seed);
    next.assessments[key] = result.assessment;
    next.autoValues[key] = result.autoValue;
    next.evidence[key] = generatedEvidence(checkpoint);
  }
  return next;
}

export function getInspectionSimulationSummary(
  sections: readonly InspectionSection[],
  checkpoints: readonly InspectionCheckpoint[],
  vehicle: SimulationVehicle,
  simulation: InspectionSimulation
): InspectionSimulationSummary {
  const activeCheckpoints = filterCheckpointsForVehicle(
    checkpoints,
    vehicle.vehicle_type
  );
  const unresolvedCheckpoints = activeCheckpoints.filter(
    (checkpoint) =>
      checkpoint.is_conditional &&
      simulation.applicability[String(checkpoint.checkpoint_no)] == null
  );
  const notApplicableCheckpoints = activeCheckpoints.filter(
    (checkpoint) =>
      checkpoint.is_conditional &&
      simulation.applicability[String(checkpoint.checkpoint_no)] === false
  );
  const applicableCheckpoints = activeCheckpoints.filter(
    (checkpoint) =>
      !checkpoint.is_conditional ||
      simulation.applicability[String(checkpoint.checkpoint_no)] === true
  );

  const missingEvidence: MissingSimulationEvidence[] = [];
  const criticalFailures: InspectionCheckpoint[] = [];
  let completed = 0;

  for (const checkpoint of applicableCheckpoints) {
    const key = String(checkpoint.checkpoint_no);
    const assessment = simulation.assessments[key] ?? createEmptyAssessment();
    const autoValue = simulation.autoValues[key] ?? "";
    const evidence = simulation.evidence[key] ?? [];
    const assessmentComplete = isAssessmentComplete(
      checkpoint,
      assessment,
      checkpoint.is_conditional ? true : undefined,
      autoValue
    );
    const assessmentStarted = isAssessmentStarted(
      checkpoint,
      assessment,
      checkpoint.is_conditional ? true : undefined,
      autoValue
    );
    const evidenceDue =
      checkpoint.evidence_required !== "Not required" &&
      (assessmentStarted || assessment.evidenceDue);
    const evidenceComplete = hasRequiredEvidence(
      checkpoint.evidence_required,
      evidence
    );

    if (assessmentComplete && evidenceComplete) completed += 1;
    if (evidenceDue && !evidenceComplete) {
      const available = new Set(evidence.map((item) => item.mediaType));
      missingEvidence.push({
        checkpoint,
        missingMedia: getRequiredSimulationMedia(checkpoint).filter(
          (mediaType) => !available.has(mediaType)
        ),
      });
    }
    if (isCriticalFailure(checkpoint, assessment)) {
      criticalFailures.push(checkpoint);
    }
  }

  const pending = applicableCheckpoints.length - completed;
  const sectionProgress = sections.map((section) => {
    const inSection = activeCheckpoints.filter(
      (checkpoint) => checkpoint.section_no === section.section_no
    );
    const sectionApplicable = applicableCheckpoints.filter(
      (checkpoint) => checkpoint.section_no === section.section_no
    );
    const sectionCompleted = sectionApplicable.filter((checkpoint) => {
      const key = String(checkpoint.checkpoint_no);
      return (
        isAssessmentComplete(
          checkpoint,
          simulation.assessments[key] ?? createEmptyAssessment(),
          checkpoint.is_conditional ? true : undefined,
          simulation.autoValues[key] ?? ""
        ) &&
        hasRequiredEvidence(
          checkpoint.evidence_required,
          simulation.evidence[key] ?? []
        )
      );
    }).length;
    const unresolved = inSection.filter(
      (checkpoint) =>
        checkpoint.is_conditional &&
        simulation.applicability[String(checkpoint.checkpoint_no)] == null
    ).length;
    const notApplicable = inSection.filter(
      (checkpoint) =>
        checkpoint.is_conditional &&
        simulation.applicability[String(checkpoint.checkpoint_no)] === false
    ).length;
    return {
      section,
      completed: sectionCompleted,
      totalApplicable: sectionApplicable.length,
      unresolved,
      notApplicable,
      percentage:
        sectionApplicable.length === 0
          ? unresolved === 0
            ? 100
            : 0
          : Math.round((sectionCompleted / sectionApplicable.length) * 100),
    };
  });

  const unresolved = unresolvedCheckpoints.length;
  const submissionEligible =
    pending === 0 && unresolved === 0 && missingEvidence.length === 0;
  const safetyStatus =
    !submissionEligible
      ? "INCOMPLETE"
      : criticalFailures.length > 0
        ? "BLOCKED"
        : "CLEARED";

  return {
    activeCheckpointCount: activeCheckpoints.length,
    totalApplicable: applicableCheckpoints.length,
    completed,
    pending,
    unresolved,
    notApplicable: notApplicableCheckpoints.length,
    missingEvidence,
    criticalFailures,
    sectionProgress,
    safetyStatus,
    submissionEligible,
  };
}
