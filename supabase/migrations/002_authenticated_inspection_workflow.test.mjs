import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  new URL("./002_authenticated_inspection_workflow.sql", import.meta.url),
  "utf8"
).toLowerCase();
const inspectionClient = readFileSync(
  new URL("../../src/app/inspections/InspectionChecklist.tsx", import.meta.url),
  "utf8"
);
const staffClient = readFileSync(
  new URL("../../src/lib/supabase/staff.ts", import.meta.url),
  "utf8"
);

function functionBody(name) {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const next = migration.indexOf("\ncreate or replace function public.", start + 1);
  return migration.slice(start, next === -1 ? migration.length : next);
}

test("canonical checklist validation rejects count, applicability, and metadata drift", () => {
  const body = functionBody("assert_inspection_checklist_integrity");
  assert.match(body, /v_section_count <> 22/);
  assert.match(body, /v_checkpoint_count <> 260/);
  assert.match(body, /v_active_count <> 260/);
  assert.match(body, /v_applicable_count <> 250 or v_conditional_count <> 4/);
  assert.match(body, /v_applicable_count <> 243 or v_conditional_count <> 5/);
  assert.match(body, /checkpoint_no = 115 and active_for = 'scooter'/);
  assert.match(body, /checkpoint_no = 125 and active_for = 'motorcycle'/);
  assert.match(body, /a17a3650859f6f7553d4f05f4682d012/);
});

test("conditional not-applicable decisions require admin authorization and reasons", () => {
  const authorize = functionBody("authorize_checkpoint_not_applicable");
  const submit = functionBody("submit_inspection");
  assert.match(authorize, /current_inspection_role\(\) <> 'admin'/);
  assert.match(authorize, /length\(btrim\(coalesce\(p_reason, ''\)\)\) not between 10 and 500/);
  assert.match(authorize, /assert_inspection_checklist_integrity/);
  assert.match(authorize, /r\.applicable = false/);
  assert.match(authorize, /r\.result_status = 'not_applicable'/);
  assert.match(submit, /inspection_applicability_authorizations/);
  assert.match(submit, /v_unresolved > 0/);
});

test("checkpoint and evidence writes serialize against inspection submission", () => {
  const resultGuard = functionBody("guard_checkpoint_result_write");
  const evidenceGuard = functionBody("guard_evidence_row_write");
  const objectGuard = functionBody("guard_inspection_evidence_object_write");
  const submit = functionBody("submit_inspection");
  assert.match(resultGuard, /for update/);
  assert.match(evidenceGuard, /for update of i/);
  assert.match(objectGuard, /for update of i/);
  assert.match(submit, /for update/);
  assert.match(resultGuard, /v_status not in \('draft', 'in_progress'\)/);
  assert.match(evidenceGuard, /v_status not in \('draft', 'in_progress'\)/);
  assert.match(objectGuard, /v_status not in \('draft', 'in_progress'\)/);
});

test("private evidence storage has an allow-list, size limit, and ownership policies", () => {
  assert.match(migration, /values \(\s*'inspection-evidence',\s*'inspection-evidence',\s*false,\s*20 \* 1024 \* 1024/s);
  assert.match(migration, /'image\/jpeg',\s*'image\/png',\s*'image\/webp'/);
  assert.match(migration, /'video\/mp4',\s*'video\/quicktime',\s*'video\/webm'/);
  assert.match(migration, /create policy inspection_evidence_insert_open_owner/);
  assert.match(migration, /create policy inspection_evidence_authenticated_write_guard/);
  assert.match(functionBody("guard_inspection_evidence_object_write"), /unsupported inspection evidence mime type/);
});

test("sensitive records are read-only to clients and inspection updates are column-restricted", () => {
  assert.match(migration, /grant update \(\s*status,\s*applicability,\s*progress,\s*gps_lat,\s*gps_lng,\s*selected_mechanic_id\s*\) on public\.inspections/);
  assert.match(migration, /selected_mechanic_id is null[\s\S]*?p\.role = 'mechanic'[\s\S]*?p\.is_active/);
  assert.match(migration, /grant select on public\.vehicle_ratings,\s*public\.repair_jobs,\s*public\.repair_updates,\s*public\.quality_reviews/);
  assert.doesNotMatch(migration, /grant (?:select, )?insert[^;]*public\.repair_jobs/is);
  assert.doesNotMatch(migration, /grant (?:select, )?insert[^;]*public\.quality_reviews/is);
  assert.match(migration, /create policy audit_logs_read_admin/);
  assert.match(migration, /create policy inspector_dealer_assignments_read_admin/);
  assert.match(migration, /create policy inspector_accuracy_events_read_admin/);
  assert.match(migration, /create policy inspections_read_owner_or_admin/);
  assert.match(migration, /is_assigned_repair_inspection\(inspections\.id\)/);
  assert.match(migration, /has_assigned_repair_for_vehicle\(id\)/);
});

test("repair, reinspection, and QC transitions are authorized and audited", () => {
  assert.match(migration, /create unique index if not exists inspections_one_open_per_vehicle/);
  assert.match(migration, /create unique index if not exists inspections_one_reinspection_per_parent/);
  assert.match(migration, /create unique index if not exists repair_jobs_one_per_checkpoint_result/);
  assert.match(functionBody("assign_repair_job"), /current_inspection_role\(\) <> 'admin'/);
  assert.match(functionBody("complete_repair_job"), /v_mechanic_id is distinct from auth\.uid\(\)/);
  assert.match(functionBody("verify_repair_job"), /current_inspection_role\(\) not in \('admin', 'quality_controller'\)/);
  assert.match(functionBody("start_reinspection"), /j\.status <> 'verified'/);
  assert.match(functionBody("finalize_quality_review"), /safety_clearance <> 'cleared'/);
  assert.match(functionBody("finalize_quality_review"), /critical_failures <> 0/);
  assert.match(functionBody("finalize_quality_review"), /set status = case when p_approved then 'approved' else 'rejected' end/);
  assert.match(functionBody("finalize_quality_review"), /set sale_ready = true/);
});

test("sale readiness requires cleared safety and a final QC approval", () => {
  const guard = functionBody("guard_vehicle_rating_sale_ready");
  assert.match(guard, /current_inspection_role\(\) not in \('admin', 'quality_controller'\)/);
  assert.match(guard, /safety_clearance <> 'cleared'/);
  assert.match(guard, /critical_failures <> 0/);
  assert.match(guard, /i\.status = 'approved'/);
  assert.match(guard, /q\.review_type = 'final_approval'/);
  assert.match(guard, /q\.status = 'approved'/);
  assert.match(migration, /set sale_ready = false\s+where sale_ready/);
});

test("client retries preserve checkpoint identity and reconcile evidence duplicates", () => {
  assert.match(inspectionClient, /select\("id, checkpoint_no"\)[\s\S]*?eq\("inspection_id", inspection\.id\)/);
  assert.match(inspectionClient, /\.\.\.\(existingResultIdByCheckpoint\.has\(checkpoint\.checkpoint_no\)[\s\S]*?id: existingResultIdByCheckpoint\.get/);
  assert.match(inspectionClient, /\.upsert\(checkpointPayload/);
  assert.match(inspectionClient, /\.from\("evidence"\)[\s\S]*?\.insert\(evidencePayload\)/);
  assert.match(inspectionClient, /Evidence retry could not be verified/);
  assert.doesNotMatch(inspectionClient, /\.from\("evidence"\)[\s\S]{0,500}?\.upsert\(/);
});

test("mechanic and quality-controller actions use role-specific server RPCs", () => {
  assert.match(staffClient, /"mechanic" \| "quality_controller"/);
  assert.match(inspectionClient, /"complete_repair_job"/);
  assert.match(inspectionClient, /"verify_repair_job"/);
  assert.match(inspectionClient, /"finalize_quality_review"/);
  assert.match(inspectionClient, /"start_reinspection"/);
  assert.match(
    inspectionClient,
    /!\["submitted", "approved", "rejected", "cancelled"\]\.includes\(\s*inspection\.status\s*\)/
  );
});
