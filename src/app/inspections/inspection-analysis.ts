import {
  isCriticalFailure,
  type CheckpointAssessment,
  type InspectionCheckpoint,
} from "./checklist-model";

export type InspectionAnalysisRow = {
  checkpoint: InspectionCheckpoint;
  sectionLabel: string;
  sectionName: string;
  assessment: CheckpointAssessment;
  assessmentStarted: boolean;
  assessmentComplete: boolean;
  complete: boolean;
  evidenceDue: boolean;
  evidenceMissing: boolean;
};

export type ScoreComponent = {
  checkpointNo: number;
  checkpointName: string;
  value: number;
  basis: string;
};

export type RepairRecommendation = {
  row: InspectionAnalysisRow;
  priority: "Critical" | "High" | "Medium" | "Low";
  action: string;
};

export type ConditionCategory =
  | "Excellent"
  | "Very Good"
  | "Good"
  | "Fair"
  | "Poor";

export type InspectionAnalysis = {
  score: number | null;
  starRating: number | null;
  category: ConditionCategory | null;
  minimumScoreableCheckpoints: number;
  scoredCheckpointCount: number;
  scoreComponents: ScoreComponent[];
  passedChecks: InspectionAnalysisRow[];
  criticalFailures: InspectionAnalysisRow[];
  cosmeticIssues: InspectionAnalysisRow[];
  otherFailures: InspectionAnalysisRow[];
  recommendations: RepairRecommendation[];
  summary: string;
};

const minimumScoreableCheckpoints = 5;

function isFailed(row: InspectionAnalysisRow) {
  return (
    row.assessment.resultStatus === "fail" ||
    row.assessment.matchStatus === "mismatch" ||
    (row.checkpoint.assessment_method === "Present/Absent" &&
      row.assessment.recordedValue === "Absent")
  );
}

function conditionCategory(score: number): ConditionCategory {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  return "Poor";
}

function buildScoreComponents(rows: InspectionAnalysisRow[]): ScoreComponent[] {
  return rows.flatMap((row) => {
    const components: ScoreComponent[] = [];
    const method = row.checkpoint.assessment_method;
    const usesPassFail =
      method.includes("Pass/Fail") ||
      method === "Tamper check" ||
      method === "Match + tamper check" ||
      method === "Measured vs spec" ||
      method === "Age vs threshold" ||
      (method === "Present/Absent" &&
        row.checkpoint.classification === "Critical");
    const status = row.assessment.resultStatus;
    if (usesPassFail && (status === "pass" || status === "fail")) {
      components.push({
        checkpointNo: row.checkpoint.checkpoint_no,
        checkpointName: row.checkpoint.name,
        value: status === "pass" ? 100 : 0,
        basis: `Pass/fail: ${status}`,
      });
    }

    const match = method.includes("Match")
      ? row.assessment.matchStatus
      : null;
    if (match) {
      components.push({
        checkpointNo: row.checkpoint.checkpoint_no,
        checkpointName: row.checkpoint.name,
        value: match === "match" ? 100 : 0,
        basis: `Identity match: ${match}`,
      });
    }

    const cosmeticScore = method.startsWith("1–5 scale")
      ? row.assessment.cosmeticScore
      : null;
    if (cosmeticScore !== null) {
      components.push({
        checkpointNo: row.checkpoint.checkpoint_no,
        checkpointName: row.checkpoint.name,
        value: cosmeticScore * 20,
        basis: `Cosmetic rating: ${cosmeticScore}/5`,
      });
    }
    return components;
  });
}

function buildRecommendations(
  criticalFailures: InspectionAnalysisRow[],
  otherFailures: InspectionAnalysisRow[],
  cosmeticIssues: InspectionAnalysisRow[]
) {
  const recommendations = new Map<number, RepairRecommendation>();

  for (const row of criticalFailures) {
    recommendations.set(row.checkpoint.checkpoint_no, {
      row,
      priority: "Critical",
      action: "Resolve the recorded critical failure, then repeat this check.",
    });
  }

  for (const row of otherFailures) {
    const checkpointNo = row.checkpoint.checkpoint_no;
    if (recommendations.has(checkpointNo)) continue;
    recommendations.set(checkpointNo, {
      row,
      priority: "High",
      action: "Investigate the recorded failure, correct it if needed, and reassess.",
    });
  }

  for (const row of cosmeticIssues) {
    const checkpointNo = row.checkpoint.checkpoint_no;
    if (recommendations.has(checkpointNo)) continue;
    const score = row.assessment.cosmeticScore ?? 0;
    recommendations.set(checkpointNo, {
      row,
      priority: score <= 1 ? "Medium" : "Low",
      action: "Review the recorded low cosmetic rating and confirm any refurbishment needed.",
    });
  }

  return [...recommendations.values()];
}

export function buildInspectionAnalysis({
  vehicleName,
  rows,
  applicableCheckpointCount,
  unresolvedApplicabilityCount,
  safetyStatus,
  submissionEligible,
}: {
  vehicleName: string;
  rows: InspectionAnalysisRow[];
  applicableCheckpointCount: number;
  unresolvedApplicabilityCount: number;
  safetyStatus: string;
  submissionEligible: boolean;
}): InspectionAnalysis {
  const scoreComponents = buildScoreComponents(rows);
  const scoredCheckpointCount = new Set(
    scoreComponents.map((component) => component.checkpointNo)
  ).size;
  const score =
    scoredCheckpointCount >= minimumScoreableCheckpoints
      ? Math.round(
          scoreComponents.reduce((total, component) => total + component.value, 0) /
            scoreComponents.length
        )
      : null;
  const starRating = score === null ? null : Math.round((score / 20) * 10) / 10;
  const category = score === null ? null : conditionCategory(score);
  const passedChecks = rows.filter(
    (row) =>
      row.assessment.resultStatus === "pass" ||
      row.assessment.matchStatus === "match" ||
      (row.assessment.cosmeticScore !== null &&
        row.assessment.cosmeticScore >= 4)
  );
  const criticalFailures = rows.filter((row) =>
    isCriticalFailure(row.checkpoint, row.assessment)
  );
  const cosmeticIssues = rows.filter(
    (row) =>
      (row.checkpoint.classification === "Cosmetic" ||
        row.checkpoint.classification === "Mixed") &&
      row.assessment.cosmeticScore !== null &&
      row.assessment.cosmeticScore <= 2
  );
  const otherFailures = rows.filter(
    (row) => isFailed(row) && !isCriticalFailure(row.checkpoint, row.assessment)
  );
  const recommendations = buildRecommendations(
    criticalFailures,
    otherFailures,
    cosmeticIssues
  );
  const assessedCount = rows.filter((row) => row.assessmentStarted).length;
  const incompleteCount = rows.filter((row) => !row.complete).length;
  const summary =
    scoreComponents.length === 0
      ? "No score-bearing inspection results have been entered. Complete more checkpoints to generate a meaningful analysis."
      : [
          `${vehicleName}: ${assessedCount} of ${applicableCheckpointCount} applicable checkpoints have assessment input.`,
          score === null
            ? `Condition score withheld: only ${scoredCheckpointCount} distinct checkpoint(s) have score-bearing results; at least ${minimumScoreableCheckpoints} are required.`
            : `Condition score: ${score}/100 (${category}, ${starRating}/5 stars).`,
          criticalFailures.length > 0
            ? `${criticalFailures.length} recorded critical failure(s) block safety clearance.`
            : incompleteCount > 0 || unresolvedApplicabilityCount > 0
              ? "Safety clearance is not established because applicable checks or applicability decisions remain incomplete."
              : `No critical failures were recorded in the completed checklist; workspace safety status is ${safetyStatus.toLowerCase()}.`,
          submissionEligible
            ? "The checklist is eligible for submission, but this demo analysis does not approve the vehicle for sale."
            : "The checklist is not yet eligible for submission.",
          "This is a local rule-based demo summary, not an external AI assessment.",
        ].join(" ");

  return {
    score,
    starRating,
    category,
    minimumScoreableCheckpoints,
    scoredCheckpointCount,
    scoreComponents,
    passedChecks,
    criticalFailures,
    cosmeticIssues,
    otherFailures,
    recommendations,
    summary,
  };
}
