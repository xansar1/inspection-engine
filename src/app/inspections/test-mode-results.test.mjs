import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseInspectionChecklist } from "./checklist-model.ts";
import {
  createInspectionSimulation,
  getInspectionSimulationSummary,
} from "./test-mode-model.ts";
import {
  createTestModeResult,
  getLatestTestModeResultForVehicle,
  getTestModeResultsForVehicle,
  readTestModeResults,
  saveTestModeResult,
  submitTestModeSimulation,
  TEST_MODE_RESULTS_STORAGE_KEY,
} from "./test-mode-results.ts";

const checklist = parseInspectionChecklist(
  JSON.parse(
    readFileSync(
      new URL("../../data/inspection-checklist.seed.json", import.meta.url),
      "utf8"
    )
  )
);

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

function createRun(id, vehicleId, registrationNumber, simulatedAt) {
  const vehicle = {
    id: vehicleId,
    make: "Honda",
    model: "Activa",
    variant: "6G",
    registration_number: registrationNumber,
    vehicle_type: "scooter",
    fuel_type: "Petrol",
    engine_capacity: "109.51 cc",
    manufacturing_year: 2022,
    registration_year: 2022,
    colour: "Blue",
    chassis_number: "TEST-CHASSIS",
    engine_number: "TEST-ENGINE",
    odometer_reading_km: 18500,
    owner_count: 1,
    has_abs: true,
    has_parking_brake: false,
    has_catalytic_converter: true,
  };
  const simulation = createInspectionSimulation(
    checklist.checkpoints,
    vehicle,
    id,
    simulatedAt
  );
  const summary = getInspectionSimulationSummary(
    checklist.sections,
    checklist.checkpoints,
    vehicle,
    simulation
  );
  return {
    vehicle,
    simulation,
    summary,
    result: createTestModeResult(
      id,
      simulatedAt,
      vehicle,
      checklist.checkpoints,
      simulation,
      summary
    ),
  };
}

test("local persistence appends runs for multiple vehicles without overwriting", () => {
  const storage = new MemoryStorage();
  const first = createRun(
    "run-1",
    "vehicle-1",
    "KA 03 AB 1234",
    "2026-01-01T10:00:00.000Z"
  );
  const second = createRun(
    "run-2",
    "vehicle-2",
    "KA 04 CD 5678",
    "2026-01-02T10:00:00.000Z"
  );

  saveTestModeResult(first.result, storage);
  saveTestModeResult(second.result, storage);

  const results = readTestModeResults(storage);
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => result.vehicleId).sort(),
    ["vehicle-1", "vehicle-2"]
  );
  assert.ok(storage.getItem(TEST_MODE_RESULTS_STORAGE_KEY));
});

test("results are retrieved by vehicle ID and return the latest run", () => {
  const storage = new MemoryStorage();
  const oldRun = createRun(
    "run-old",
    "vehicle-1",
    "KA 03 AB 1234",
    "2026-01-01T10:00:00.000Z"
  );
  const otherVehicle = createRun(
    "run-other",
    "vehicle-2",
    "KA 04 CD 5678",
    "2026-01-03T10:00:00.000Z"
  );
  const latestRun = createRun(
    "run-latest",
    "vehicle-1",
    "KA 03 AB 1234",
    "2026-01-02T10:00:00.000Z"
  );

  saveTestModeResult(oldRun.result, storage);
  saveTestModeResult(otherVehicle.result, storage);
  saveTestModeResult(latestRun.result, storage);

  assert.equal(
    getLatestTestModeResultForVehicle("vehicle-1", storage)?.id,
    "run-latest"
  );
  assert.deepEqual(
    getTestModeResultsForVehicle("vehicle-2", storage).map((result) => result.id),
    ["run-other"]
  );
  assert.equal(getLatestTestModeResultForVehicle("unknown", storage), null);
});

test("corrupted localStorage is reported and never overwritten", () => {
  const storage = new MemoryStorage();
  storage.setItem(TEST_MODE_RESULTS_STORAGE_KEY, "{not-json");

  assert.throws(
    () => getLatestTestModeResultForVehicle("vehicle-1", storage),
    /Stored Test Mode results are corrupted/
  );
  assert.throws(
    () =>
      saveTestModeResult(
        createRun(
          "run-1",
          "vehicle-1",
          "KA 03 AB 1234",
          "2026-01-01T10:00:00.000Z"
        ).result,
        storage
      ),
    /Stored Test Mode results are corrupted/
  );
  assert.equal(storage.getItem(TEST_MODE_RESULTS_STORAGE_KEY), "{not-json");
});

test("unavailable localStorage produces an explicit error", () => {
  const unavailableStorage = {
    getItem() {
      throw new Error("storage access denied");
    },
    setItem() {
      throw new Error("storage access denied");
    },
  };
  assert.throws(
    () => readTestModeResults(unavailableStorage),
    /Browser localStorage could not be read/
  );
  assert.throws(
    () => readTestModeResults(),
    /available only in a browser/
  );

  const run = createRun(
    "run-storage-error",
    "vehicle-1",
    "KA 03 AB 1234",
    "2026-02-01T10:00:00.000Z"
  );
  const navigation = [];
  assert.throws(
    () =>
      submitTestModeSimulation(
        run.summary,
        run.result,
        (path) => navigation.push(path),
        unavailableStorage
      ),
    /Browser localStorage could not be read/
  );
  assert.deepEqual(navigation, []);

  const writeDeniedStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("storage quota exceeded");
    },
  };
  assert.throws(
    () =>
      submitTestModeSimulation(
        run.summary,
        run.result,
        (path) => navigation.push(path),
        writeDeniedStorage
      ),
    /could not save the Test Mode result/
  );
  assert.deepEqual(navigation, []);
});

test("successful simulated submission saves locally before navigating to dashboard", () => {
  const storage = new MemoryStorage();
  const run = createRun(
    "run-submit",
    "vehicle-1",
    "KA 03 AB 1234",
    "2026-02-01T10:00:00.000Z"
  );
  const navigation = [];
  const outcome = submitTestModeSimulation(
    run.summary,
    run.result,
    (path) => navigation.push(path),
    storage
  );

  assert.deepEqual(outcome, { success: true, errors: [] });
  assert.deepEqual(navigation, ["/dashboard"]);
  assert.equal(
    getLatestTestModeResultForVehicle("vehicle-1", storage)?.id,
    "run-submit"
  );
});

test("failed local validation neither persists nor navigates", () => {
  const storage = new MemoryStorage();
  const run = createRun(
    "run-invalid",
    "vehicle-1",
    "KA 03 AB 1234",
    "2026-02-01T10:00:00.000Z"
  );
  const navigation = [];
  const outcome = submitTestModeSimulation(
    {
      ...run.summary,
      pending: 1,
      unresolved: 1,
      missingEvidence: [
        {
          checkpoint: checklist.checkpoints[0],
          missingMedia: ["photo"],
        },
      ],
      submissionEligible: false,
    },
    run.result,
    (path) => navigation.push(path),
    storage
  );

  assert.equal(outcome.success, false);
  assert.equal(outcome.errors.length, 3);
  assert.deepEqual(navigation, []);
  assert.equal(storage.getItem(TEST_MODE_RESULTS_STORAGE_KEY), null);
});

test("stored simulations contain no live inspection identity or uploaded-file data", () => {
  const run = createRun(
    "run-separation",
    "vehicle-1",
    "KA 03 AB 1234",
    "2026-02-01T10:00:00.000Z"
  );
  const stored = JSON.stringify(run.result);
  assert.match(stored, /TEST DATA/);
  assert.doesNotMatch(stored, /inspection_id|checkpoint_result_id|storage_path/i);
  assert.doesNotMatch(stored, /service_role|access_token|refresh_token|password/i);
  assert.ok(
    run.result.checkpoints.every((checkpoint) =>
      checkpoint.evidence.every(
        (evidence) =>
          JSON.stringify(Object.keys(evidence).sort()) ===
          JSON.stringify(["label", "mediaType"])
      )
    )
  );
  assert.equal(run.result.checkpoints.length, 248);
  assert.equal(run.result.submissionEligible, true);
});
