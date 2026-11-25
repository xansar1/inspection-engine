import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  hasRequiredEvidence,
  isAssessmentComplete,
  parseInspectionChecklist,
} from "./checklist-model.ts";
import {
  createInspectionSimulation,
  getInspectionSimulationSummary,
  getRequiredSimulationMedia,
  getSimulationApplicability,
  setSimulationApplicability,
} from "./test-mode-model.ts";
import { filterCheckpointsForVehicle } from "./vehicle-applicability.ts";

const checklist = parseInspectionChecklist(
  JSON.parse(
    readFileSync(
      new URL("../../data/inspection-checklist.seed.json", import.meta.url),
      "utf8"
    )
  )
);
const testModeComponent = readFileSync(
  new URL("./test-mode/InspectionTestMode.tsx", import.meta.url),
  "utf8"
);
const testModeMiddleware = readFileSync(
  new URL("../../../middleware.ts", import.meta.url),
  "utf8"
);
const testModePersistence = readFileSync(
  new URL("./test-mode-results.ts", import.meta.url),
  "utf8"
);

function testVehicle(vehicleType = "motorcycle", equipment = {}) {
  return {
    id: `test-${vehicleType}`,
    make: "Honda",
    model: "Activa",
    variant: "6G",
    registration_number: "KA 03 AB 1234",
    vehicle_type: vehicleType,
    fuel_type: "Petrol",
    engine_capacity: "109.51 cc",
    manufacturing_year: 2022,
    registration_year: 2022,
    colour: "Blue",
    chassis_number: "TEST-CHASSIS-001",
    engine_number: "TEST-ENGINE-001",
    odometer_reading_km: 18500,
    owner_count: 1,
    has_abs: true,
    has_parking_brake: false,
    has_catalytic_converter: true,
    ...equipment,
  };
}

test("simulation generates complete method-specific assessments and local evidence", () => {
  const generatedMethodCoverage = new Set();
  for (const vehicleType of ["motorcycle", "scooter"]) {
    const vehicle = testVehicle(vehicleType);
    const simulation = createInspectionSimulation(
      checklist.checkpoints,
      vehicle,
      "assessment-method-test",
      "2026-01-01T10:00:00.000Z"
    );
    const summary = getInspectionSimulationSummary(
      checklist.sections,
      checklist.checkpoints,
      vehicle,
      simulation
    );

    assert.equal(summary.pending, 0, `${vehicleType} has a pending generated check`);
    assert.equal(summary.unresolved, 0);
    assert.equal(summary.missingEvidence.length, 0);
    assert.equal(summary.submissionEligible, true);

    const active = filterCheckpointsForVehicle(
      checklist.checkpoints,
      vehicleType
    );
    for (const checkpoint of active) {
      if (
        checkpoint.is_conditional &&
        simulation.applicability[String(checkpoint.checkpoint_no)] !== true
      ) {
        continue;
      }
      generatedMethodCoverage.add(checkpoint.assessment_method);
      const key = String(checkpoint.checkpoint_no);
      assert.ok(
        isAssessmentComplete(
          checkpoint,
          simulation.assessments[key],
          checkpoint.is_conditional ? true : undefined,
          simulation.autoValues[key] ?? ""
        ),
        `${vehicleType} checkpoint ${checkpoint.checkpoint_no} (${checkpoint.assessment_method}) is incomplete`
      );
      assert.equal(
        hasRequiredEvidence(
          checkpoint.evidence_required,
          simulation.evidence[key] ?? []
        ),
        true,
        `${vehicleType} checkpoint ${checkpoint.checkpoint_no} lacks generated evidence`
      );
    }

    for (const [checkpointNo, evidence] of Object.entries(simulation.evidence)) {
      for (const item of evidence) {
        assert.match(item.id, /^test-/);
        assert.match(item.label, /TEST DATA/);
        assert.ok(Number(checkpointNo) > 0);
      }
    }
  }
  assert.equal(generatedMethodCoverage.size, 24);
});

test("conditional decisions follow registered equipment and remain changeable locally", () => {
  const motorcycle = testVehicle("motorcycle");
  const conditional = (checkpointNo) =>
    checklist.checkpoints.find(
      (checkpoint) => checkpoint.checkpoint_no === checkpointNo
    );

  assert.equal(getSimulationApplicability(conditional(55), motorcycle), true);
  assert.equal(
    getSimulationApplicability(
      conditional(55),
      testVehicle("motorcycle", { has_abs: false })
    ),
    false
  );
  assert.equal(getSimulationApplicability(conditional(115), motorcycle), false);
  assert.equal(
    getSimulationApplicability(conditional(115), testVehicle("scooter")),
    true
  );
  assert.equal(getSimulationApplicability(conditional(198), motorcycle), true);
  assert.equal(getSimulationApplicability(conditional(210), motorcycle), false);
  assert.equal(getSimulationApplicability(conditional(256), motorcycle), true);
  assert.equal(
    getSimulationApplicability(
      conditional(256),
      testVehicle("motorcycle", {
        registration_year: null,
        manufacturing_year: null,
      })
    ),
    null
  );

  const simulation = createInspectionSimulation(
    checklist.checkpoints,
    motorcycle
  );
  const unresolved = setSimulationApplicability(
    simulation,
    conditional(256),
    motorcycle,
    null
  );
  const summary = getInspectionSimulationSummary(
    checklist.sections,
    checklist.checkpoints,
    motorcycle,
    unresolved
  );
  assert.equal(summary.unresolved, 1);
  assert.equal(summary.submissionEligible, false);
});

test("vehicle applicability excludes scooter-only and motorcycle-only checkpoints", () => {
  const motorcycle = filterCheckpointsForVehicle(
    checklist.checkpoints,
    "motorcycle"
  );
  const scooter = filterCheckpointsForVehicle(
    checklist.checkpoints,
    "scooter"
  );
  assert.equal(motorcycle.length, 254);
  assert.equal(scooter.length, 248);
  assert.equal(
    motorcycle.some((checkpoint) => checkpoint.checkpoint_no === 115),
    false
  );
  assert.equal(
    scooter.some((checkpoint) => checkpoint.checkpoint_no === 125),
    false
  );
});

test("Photo, Video, and Photo+Video requirements are validated independently", () => {
  const evidenceCheckpoint = (evidence_required) => ({
    ...checklist.checkpoints[0],
    evidence_required,
  });
  const photo = [{ mediaType: "photo" }];
  const video = [{ mediaType: "video" }];

  assert.deepEqual(getRequiredSimulationMedia(evidenceCheckpoint("Photo")), [
    "photo",
  ]);
  assert.deepEqual(getRequiredSimulationMedia(evidenceCheckpoint("Video")), [
    "video",
  ]);
  assert.deepEqual(
    getRequiredSimulationMedia(evidenceCheckpoint("Photo+Video")),
    ["photo", "video"]
  );
  assert.deepEqual(getRequiredSimulationMedia(evidenceCheckpoint("Not required")), []);
  assert.equal(hasRequiredEvidence("Photo", photo), true);
  assert.equal(hasRequiredEvidence("Photo", video), false);
  assert.equal(hasRequiredEvidence("Video", video), true);
  assert.equal(hasRequiredEvidence("Photo+Video", photo), false);
  assert.equal(
    hasRequiredEvidence("Photo+Video", [...photo, ...video]),
    true
  );
  assert.equal(hasRequiredEvidence("Not required", []), true);

  const simulation = createInspectionSimulation(
    checklist.checkpoints,
    testVehicle(),
    "evidence-test"
  );
  const photoVideoCheckpoint = checklist.checkpoints.find(
    (checkpoint) => checkpoint.evidence_required === "Photo+Video"
  );
  assert.ok(photoVideoCheckpoint);
  const key = String(photoVideoCheckpoint.checkpoint_no);
  const withoutVideo = {
    ...simulation,
    evidence: { ...simulation.evidence, [key]: photo },
  };
  const summary = getInspectionSimulationSummary(
    checklist.sections,
    checklist.checkpoints,
    testVehicle(),
    withoutVideo
  );
  assert.ok(
    summary.missingEvidence.some(
      (item) =>
        item.checkpoint.checkpoint_no === photoVideoCheckpoint.checkpoint_no &&
        item.missingMedia.includes("video")
    )
  );
});

test("submission eligibility rejects missing evidence and incomplete assessments", () => {
  const vehicle = testVehicle();
  const simulation = createInspectionSimulation(
    checklist.checkpoints,
    vehicle,
    "submission-test"
  );
  const evidenceCheckpoint = checklist.checkpoints.find(
    (checkpoint) =>
      checkpoint.evidence_required !== "Not required" &&
      !checkpoint.is_conditional
  );
  assert.ok(evidenceCheckpoint);

  const noEvidence = {
    ...simulation,
    evidence: {
      ...simulation.evidence,
      [String(evidenceCheckpoint.checkpoint_no)]: [],
    },
  };
  const evidenceSummary = getInspectionSimulationSummary(
    checklist.sections,
    checklist.checkpoints,
    vehicle,
    noEvidence
  );
  assert.equal(evidenceSummary.submissionEligible, false);
  assert.ok(evidenceSummary.missingEvidence.length > 0);

  const noAssessment = {
    ...simulation,
    assessments: {
      ...simulation.assessments,
      [String(evidenceCheckpoint.checkpoint_no)]: undefined,
    },
  };
  const pendingSummary = getInspectionSimulationSummary(
    checklist.sections,
    checklist.checkpoints,
    vehicle,
    noAssessment
  );
  assert.equal(pendingSummary.submissionEligible, false);
  assert.ok(pendingSummary.pending > 0);
});

test("critical failures block simulated safety clearance without hiding submission eligibility", () => {
  const vehicle = testVehicle();
  const simulation = createInspectionSimulation(
    checklist.checkpoints,
    vehicle,
    "critical-safety-test"
  );
  const criticalCheckpoint = checklist.checkpoints.find(
    (checkpoint) =>
      checkpoint.classification === "Critical" &&
      checkpoint.assessment_method === "Pass/Fail" &&
      !checkpoint.is_conditional
  );
  assert.ok(criticalCheckpoint);

  const failedSimulation = {
    ...simulation,
    assessments: {
      ...simulation.assessments,
      [String(criticalCheckpoint.checkpoint_no)]: {
        ...simulation.assessments[String(criticalCheckpoint.checkpoint_no)],
        resultStatus: "fail",
      },
    },
  };
  const summary = getInspectionSimulationSummary(
    checklist.sections,
    checklist.checkpoints,
    vehicle,
    failedSimulation
  );

  assert.equal(summary.safetyStatus, "BLOCKED");
  assert.equal(summary.submissionEligible, true);
  assert.ok(
    summary.criticalFailures.some(
      (checkpoint) =>
        checkpoint.checkpoint_no === criticalCheckpoint.checkpoint_no
    )
  );
});

test("Test Mode is admin-gated and contains no live inspection write path", () => {
  assert.match(testModeMiddleware, /supabase\.auth\.getUser\(\)/);
  assert.match(testModeMiddleware, /profile\?\.is_active/);
  assert.match(testModeMiddleware, /profile\.role !== "admin"/);
  assert.match(testModeMiddleware, /matcher: \["\/inspections\/test-mode\/:path\*"\]/);
  assert.match(
    testModeComponent,
    /authenticatedActor\.profile\.role !== "admin"/
  );
  assert.match(testModeComponent, /\.from\("vehicles"\)\s*\.select\(/);
  assert.doesNotMatch(testModeComponent, /\.rpc\s*\(/);
  assert.doesNotMatch(testModeComponent, /\.storage\b/);
  assert.doesNotMatch(testModeMiddleware, /SERVICE_ROLE|service_role/i);
  assert.doesNotMatch(testModePersistence, /\.from\s*\(/);
  assert.doesNotMatch(testModePersistence, /\.rpc\s*\(/);
  assert.doesNotMatch(testModePersistence, /\.storage\b/);
  assert.doesNotMatch(
    testModeComponent,
    /\.from\("(?:inspections|checkpoint_results|evidence|vehicle_ratings|repair_jobs|quality_reviews)"\)/
  );
});
