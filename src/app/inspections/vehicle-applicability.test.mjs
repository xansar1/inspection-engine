import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseInspectionChecklist } from "./checklist-model.ts";
import { filterCheckpointsForVehicle } from "./vehicle-applicability.ts";

const seed = JSON.parse(
  readFileSync(
    new URL("../../data/inspection-checklist.seed.json", import.meta.url),
    "utf8"
  )
);

test("live checklist validation accepts the complete canonical shape", () => {
  const checklist = parseInspectionChecklist(seed);

  assert.equal(checklist.sections.length, 22);
  assert.equal(checklist.checkpoints.length, 260);
});

test("live checklist validation rejects incomplete or misclassified data", () => {
  assert.throws(
    () =>
      parseInspectionChecklist({
        ...seed,
        checkpoints: seed.checkpoints.slice(1),
      }),
    /expected the ordered 1–260 set/
  );
  assert.throws(
    () =>
      parseInspectionChecklist({
        ...seed,
        checkpoints: seed.checkpoints.map((checkpoint) =>
          checkpoint.checkpoint_no === 125
            ? { ...checkpoint, active_for: "both" }
            : checkpoint
        ),
      }),
    /checkpoint 125 must be motorcycle-only/
  );
});

test("checkpoint 115 is scooter-only without changing its inspection metadata", () => {
  const checkpoint = seed.checkpoints.find(
    (candidate) => candidate.checkpoint_no === 115
  );

  assert.ok(checkpoint);
  assert.equal(checkpoint.active_for, "scooter");
  assert.equal(checkpoint.name, "Fuel Lid Lock (Scooter)");
  assert.equal(checkpoint.classification, "Critical");
  assert.equal(checkpoint.assessment_method, "Pass/Fail");
  assert.equal(checkpoint.evidence_required, "Video");
  assert.equal(checkpoint.is_conditional, true);
  assert.equal(
    filterCheckpointsForVehicle(seed.checkpoints, "motorcycle").includes(
      checkpoint
    ),
    false
  );
  assert.equal(
    filterCheckpointsForVehicle(seed.checkpoints, "scooter").includes(
      checkpoint
    ),
    true
  );
});

test("checkpoint 125 is motorcycle-only without changing its inspection metadata", () => {
  const checkpoint = seed.checkpoints.find(
    (candidate) => candidate.checkpoint_no === 125
  );

  assert.ok(checkpoint);
  assert.equal(checkpoint.active_for, "motorcycle");
  assert.equal(
    checkpoint.name,
    "Tank Shrouds (Motorcycle) — paint/scratch/dent (cosmetic); crack/rust/fitment/fasteners/clips (critical)"
  );
  assert.equal(checkpoint.classification, "Mixed");
  assert.equal(checkpoint.assessment_method, "1–5 scale + Pass/Fail");
  assert.equal(checkpoint.evidence_required, "Photo");
  assert.equal(checkpoint.is_conditional, false);
  assert.equal(
    filterCheckpointsForVehicle(seed.checkpoints, "motorcycle").includes(
      checkpoint
    ),
    true
  );
  assert.equal(
    filterCheckpointsForVehicle(seed.checkpoints, "scooter").includes(
      checkpoint
    ),
    false
  );
});

test("both checked-in SQL seeds match the corrected applicability values", () => {
  const sqlSeedPaths = [
    new URL("../../../001_inspection_engine_locked_foundation.sql", import.meta.url),
    new URL(
      "../../../supabase/migrations/001_inspection_foundation.sql",
      import.meta.url
    ),
  ];

  for (const sqlSeedPath of sqlSeedPaths) {
    const sql = readFileSync(sqlSeedPath, "utf8");

    for (const [checkpointNo, activeFor] of [
      [115, "scooter"],
      [125, "motorcycle"],
    ]) {
      const insert = sql
        .split(/\r?\n/)
        .find((line) => line.includes(`values (${checkpointNo},`));

      assert.ok(insert);
      assert.match(
        insert,
        new RegExp(`,'${activeFor}',(?:true|false)\\) on conflict`)
      );
    }
  }
});

test("vehicle-specific totals and unresolved conditionals remain correct", () => {
  const expected = {
    motorcycle: {
      active: 254,
      applicable: 250,
      unresolved: [55, 198, 210, 256],
    },
    scooter: {
      active: 248,
      applicable: 243,
      unresolved: [55, 115, 198, 210, 256],
    },
  };

  for (const vehicleType of ["motorcycle", "scooter"]) {
    const active = filterCheckpointsForVehicle(
      seed.checkpoints,
      vehicleType
    );
    const unresolved = active.filter(
      (checkpoint) => checkpoint.is_conditional
    );
    const applicable = active.filter(
      (checkpoint) => !checkpoint.is_conditional
    );

    assert.equal(active.length, expected[vehicleType].active);
    assert.equal(applicable.length, expected[vehicleType].applicable);
    assert.deepEqual(
      unresolved.map((checkpoint) => checkpoint.checkpoint_no),
      expected[vehicleType].unresolved
    );
  }
});
