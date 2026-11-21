

import { createClient } from "./client";
import {
  parseInspectionChecklist,
  type InspectionChecklistData,
} from "@/app/inspections/checklist-model";

export async function getInspectionChecklist(
  supabase = createClient()
): Promise<InspectionChecklistData | null> {
  const [sectionsResult, checkpointsResult] = await Promise.all([
    supabase
      .from("inspection_sections")
      .select("section_no, name")
      .order("section_no"),

    supabase
      .from("inspection_checkpoints")
      .select(`
        checkpoint_no,
        section_no,
        name,
        classification,
        assessment_method,
        evidence_required,
        active_for,
        is_conditional,
        is_active
      `)
      .eq("is_active", true)
      .order("checkpoint_no"),
  ]);

  if (sectionsResult.error) {
    throw new Error(
      `Sections: ${sectionsResult.error.message}`
    );
  }

  if (checkpointsResult.error) {
    throw new Error(
      `Checkpoints: ${checkpointsResult.error.message}`
    );
  }

  const sections = sectionsResult.data ?? [];
  const checkpointRows = checkpointsResult.data ?? [];
  if (sections.length === 0 && checkpointRows.length === 0) return null;

  const sectionNameByNumber = new Map(
    sections.map((section) => [section.section_no, section.name])
  );
  const checkpoints = checkpointRows.map((checkpoint) => ({
    ...checkpoint,
    section_name: sectionNameByNumber.get(checkpoint.section_no) ?? "",
  }));

  return parseInspectionChecklist({ sections, checkpoints });
}
