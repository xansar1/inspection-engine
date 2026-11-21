import assert from "node:assert/strict";
import { test } from "node:test";
import { getWorkspacePath } from "./staff.ts";

test("staff roles are redirected to the appropriate authorized workspace", () => {
  assert.equal(getWorkspacePath("admin"), "/dashboard");
  assert.equal(getWorkspacePath("inspector"), "/inspections");
  assert.equal(getWorkspacePath("mechanic"), "/inspections");
  assert.equal(getWorkspacePath("quality_controller"), "/inspections");
});
