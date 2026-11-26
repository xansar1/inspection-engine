import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  new URL("./007_all_active_staff_can_inspect.sql", import.meta.url),
  "utf8"
).toLowerCase();
const existingMigration = readFileSync(
  new URL("./002_authenticated_inspection_workflow.sql", import.meta.url),
  "utf8"
).toLowerCase();
const inspectionClient = readFileSync(
  new URL("../../src/app/inspections/InspectionChecklist.tsx", import.meta.url),
  "utf8"
);

function functionBody(source, name) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const next = source.indexOf("\ncreate or replace function public.", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function policyBody(name) {
  const start = migration.indexOf(`create policy ${name}`);
  assert.notEqual(start, -1, `missing policy ${name}`);
  const end = migration.indexOf(";", start);
  return migration.slice(start, end + 1);
}

const staffRoles =
  /'admin',\s*'inspector',\s*'mechanic',\s*'quality_controller'/;

test("all active staff can create and update only their own open inspections", () => {
  const profilePolicy = policyBody("profiles_read_self_and_workshop_staff");
  const insertPolicy = policyBody("inspections_insert_self");
  const updatePolicy = policyBody("inspections_update_open_owner_or_admin");
  assert.match(profilePolicy, staffRoles);
  assert.match(profilePolicy, /and is_active/);
  assert.match(profilePolicy, /role = 'mechanic'/);
  assert.match(insertPolicy, /inspector_id = auth\.uid\(\)/);
  assert.match(insertPolicy, staffRoles);
  assert.match(insertPolicy, /status in \('draft', 'in_progress'\)/);
  assert.match(updatePolicy, staffRoles);
  assert.match(updatePolicy, /inspector_id = auth\.uid\(\) or public\.current_inspection_role\(\) = 'admin'/);
  assert.match(updatePolicy, /status in \('draft', 'in_progress'\)/);
});

test("checkpoint results, ratings, conditional decisions, and evidence stay owner-scoped", () => {
  for (const name of [
    "checkpoint_results_read_owner_or_admin",
    "checkpoint_results_insert_open_owner",
    "checkpoint_results_update_open_owner",
    "vehicle_ratings_read_owner_or_admin",
    "evidence_read_owner_or_admin",
    "evidence_insert_open_owner",
    "evidence_delete_open_owner",
    "applicability_authorizations_read_owner_or_admin",
  ]) {
    assert.match(policyBody(name), staffRoles, `${name} must allow all staff roles`);
  }
  assert.match(policyBody("checkpoint_results_insert_open_owner"), /assessed_by = auth\.uid\(\)/);
  assert.match(policyBody("evidence_insert_open_owner"), /uploaded_by = auth\.uid\(\)/);
  assert.match(policyBody("evidence_insert_open_owner"), /i\.inspector_id = auth\.uid\(\)/);
  assert.match(policyBody("vehicle_ratings_read_owner_or_admin"), /i\.inspector_id = auth\.uid\(\)/);
});

test("private Storage access and database write guards are expanded without weakening ownership", () => {
  for (const name of [
    "inspection_evidence_read_owner_or_admin",
    "inspection_evidence_insert_open_owner",
    "inspection_evidence_update_open_owner",
    "inspection_evidence_delete_open_owner",
    "inspection_evidence_authenticated_read_guard",
    "inspection_evidence_authenticated_write_guard",
  ]) {
    assert.match(policyBody(name), staffRoles, `${name} must allow all staff roles`);
  }
  assert.match(functionBody(migration, "guard_checkpoint_result_write"), /for update/);
  assert.match(functionBody(migration, "guard_checkpoint_result_write"), /v_owner is distinct from auth\.uid\(\)/);
  assert.match(functionBody(migration, "guard_evidence_row_write"), /for update of i/);
  assert.match(functionBody(migration, "guard_evidence_row_write"), /v_owner is distinct from auth\.uid\(\)/);
  assert.match(functionBody(migration, "guard_inspection_evidence_object_write"), /for update of i/);
  assert.match(functionBody(migration, "guard_inspection_evidence_object_write"), /v_owner is distinct from auth\.uid\(\)/);
  assert.match(functionBody(migration, "guard_inspection_evidence_object_write"), /unsupported inspection evidence mime type/);
});

test("submission and linked reinspection permit all active staff while retaining ownership and checks", () => {
  const submit = functionBody(migration, "submit_inspection");
  const reinspection = functionBody(migration, "start_reinspection");
  assert.match(submit, staffRoles);
  assert.match(submit, /i\.inspector_id = auth\.uid\(\) or v_role = 'admin'/);
  assert.match(submit, /assert_inspection_checklist_integrity/);
  assert.match(submit, /v_unresolved > 0/);
  assert.match(submit, /v_incomplete > 0/);
  assert.match(submit, /v_critical_failures > 0 then 'repair_required'/);
  assert.match(reinspection, staffRoles);
  assert.match(reinspection, /i\.inspector_id = auth\.uid\(\) or public\.current_inspection_role\(\) = 'admin'/);
  assert.match(reinspection, /j\.status <> 'verified'/);
  assert.doesNotMatch(migration, /drop index[^;]*inspections_one_open_per_vehicle/);
});

test("admin-only applicability authorization and repair/QC responsibilities remain unchanged", () => {
  assert.match(
    functionBody(existingMigration, "current_inspection_role"),
    /p\.is_active/
  );
  assert.match(
    functionBody(existingMigration, "authorize_checkpoint_not_applicable"),
    /current_inspection_role\(\) <> 'admin'/
  );
  assert.match(
    functionBody(existingMigration, "assign_repair_job"),
    /current_inspection_role\(\) <> 'admin'/
  );
  assert.match(
    functionBody(existingMigration, "complete_repair_job"),
    /current_inspection_role\(\) <> 'mechanic'/
  );
  assert.match(
    functionBody(existingMigration, "verify_repair_job"),
    /current_inspection_role\(\) not in \('admin', 'quality_controller'\)/
  );
  assert.match(
    functionBody(existingMigration, "finalize_quality_review"),
    /current_inspection_role\(\) not in \('admin', 'quality_controller'\)/
  );
});

test("mechanics and quality controllers can switch between inspection and their existing workflow", () => {
  assert.doesNotMatch(
    inspectionClient,
    /authenticatedActor\.profile\.role === "mechanic"[\s\S]{0,150}setChecklist\(null\);\s*return;/
  );
  assert.match(inspectionClient, /onOpenInspection=\{\(\) => setWorkspaceMode\("inspection"\)\}/);
  assert.match(inspectionClient, /Open 260-point vehicle inspection/);
  assert.match(inspectionClient, /onOpenWorkshopWorkflow=\{\(\) => setWorkspaceMode\("workflow"\)\}/);
  assert.match(inspectionClient, /inspector_id: actor\.profile\.id/);
  assert.match(inspectionClient, /submit_inspection/);
});
