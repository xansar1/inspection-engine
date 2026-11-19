"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { DemoPanel, demoButtonClass, demoSubtleButtonClass } from "@/app/_components/DemoModuleShell";
import {
  sourceSectionLabels,
  type InspectionCheckpoint,
} from "./checklist-model";
import type {
  InspectionAnalysis,
  InspectionAnalysisRow,
} from "./inspection-analysis";

type InspectionAdvisorProps = {
  analysis: InspectionAnalysis;
  vehicleName: string;
  applicableCount: number;
  unassessedRows: InspectionAnalysisRow[];
  inProgressRows: InspectionAnalysisRow[];
  missingEvidenceRows: InspectionAnalysisRow[];
  unresolvedApplicability: InspectionCheckpoint[];
  safetyStatus: string;
  eligibleForSubmission: boolean;
  finalized: boolean;
  analysisGenerated: boolean;
  analysisGeneratedAt: string | null;
  onGenerate: () => void;
};

const priorityClasses = {
  Critical: "bg-[#FCE9E5] text-[#A53F31]",
  High: "bg-[#FFF0E0] text-[#AE5B1D]",
  Medium: "bg-[#FFF5D9] text-[#8A6A1D]",
  Low: "bg-[#EEF1E8] text-[#5D6A53]",
};

export default function InspectionAdvisor({
  analysis,
  vehicleName,
  applicableCount,
  unassessedRows,
  inProgressRows,
  missingEvidenceRows,
  unresolvedApplicability,
  safetyStatus,
  eligibleForSubmission,
  finalized,
  analysisGenerated,
  analysisGeneratedAt,
  onGenerate,
}: InspectionAdvisorProps) {
  const [copyStatus, setCopyStatus] = useState("");

  async function copySummary() {
    try {
      if (!("clipboard" in navigator)) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(analysis.summary);
      setCopyStatus("Summary copied.");
    } catch (error) {
      setCopyStatus(
        error instanceof Error
          ? `Could not copy summary: ${error.message}`
          : "Could not copy summary."
      );
    }
  }

  const qcMessage =
    analysis.criticalFailures.length > 0
      ? "Repair and re-inspection are required for failed critical checks. No QC approval is recorded in this demo."
      : analysis.recommendations.length > 0
        ? "Review suggested repairs and verify affected checks in quality control. No QC result is recorded in this demo."
        : "QC status is not recorded in this inspection workspace.";

  return (
    <DemoPanel
      title="AI Inspection Advisor — Demo Mode"
      description="Transparent local rules summarize entered checklist data only. No AI model or external service is connected."
    >
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 rounded-2xl bg-[#183D2D] p-5 text-white sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#E99A4B]">
              <Sparkles size={20} />
            </span>
            <div>
              <p className="text-[10px] font-extrabold tracking-[1.5px] text-[#E99A4B]">
                LOCAL RULE-BASED ADVISOR
              </p>
              <p className="mt-1 text-xs leading-5 text-white/75">
                {vehicleName} · {applicableCount} applicable checkpoints · analysis recalculates as results change
              </p>
            </div>
          </div>
          <button type="button" onClick={onGenerate} className={demoButtonClass}>
            {analysisGenerated ? <RefreshCw size={14} /> : <Sparkles size={14} />}
            {analysisGenerated ? "Refresh Analysis" : "Generate AI Analysis"}
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-[#E8E4D9] bg-[#FCFBF7] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold tracking-[1.3px] text-[#A27649]">
                  VEHICLE CONDITION SCORE
                </p>
                <p className="mt-3 text-5xl font-extrabold tracking-tight text-[#244A36]">
                  {analysis.score === null ? "—" : analysis.score}
                  <span className="ml-1 text-base font-semibold text-[#92958A]">/100</span>
                </p>
              </div>
              <span className="rounded-full bg-[#FFF0E0] px-3 py-1.5 text-[10px] font-extrabold text-[#A95719]">
                {analysis.category ?? "Insufficient data"}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-1 text-[#E88B35]" aria-label="Condition rating">
              {Array.from({ length: 5 }, (_, index) => (
                <Star
                  key={index}
                  size={17}
                  fill={
                    analysis.starRating !== null &&
                    index < Math.round(analysis.starRating)
                      ? "currentColor"
                      : "none"
                  }
                />
              ))}
              <span className="ml-2 text-xs font-bold text-[#344337]">
                {analysis.starRating === null
                  ? "— / 5 stars"
                  : `${analysis.starRating.toFixed(1)} / 5 stars`}
              </span>
            </div>
            <p className="mt-3 text-[10px] leading-5 text-[#697267]">
              {analysis.score === null
                ? analysis.scoredCheckpointCount === 0
                  ? "Complete more checkpoints to generate a meaningful analysis."
                  : `Insufficient assessment data: at least ${analysis.minimumScoreableCheckpoints} distinct checkpoints with score-bearing results are required.`
                : `Based on ${analysis.scoredCheckpointCount} assessed checkpoints and ${analysis.scoreComponents.length} recorded result components.`}
            </p>
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[9px] leading-4 text-[#92958A]">
              This score is informational only. It never grants safety clearance or approves a vehicle for sale.
            </p>
          </section>

          <section className="rounded-2xl border border-[#E8E4D9] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#244A36]">
                Score calculation
              </h3>
              <span className="rounded-full bg-[#F3F4ED] px-2.5 py-1 text-[9px] font-bold text-[#60715E]">
                Demo rule set
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-[10px] leading-5 text-[#697267]">
              <li>Pass or Match = 100; Fail or Mismatch = 0.</li>
              <li>Cosmetic rating 1–5 maps to 20–100.</li>
              <li>Each entered result component is equally weighted; mixed checks can contribute separate safety and cosmetic components.</li>
              <li>Unassessed, N/A, and data-only measurements are excluded. At least five distinct checkpoints are required to show a score.</li>
              <li>Category bands: Excellent ≥90, Very Good ≥80, Good ≥65, Fair ≥45, otherwise Poor.</li>
            </ul>
            {analysis.scoreComponents.length > 0 && (
              <details className="mt-3 rounded-xl bg-[#F7F6F1] p-3">
                <summary className="cursor-pointer text-[10px] font-bold text-[#315D40]">
                  View {analysis.scoreComponents.length} score components
                </summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {analysis.scoreComponents.map((component, index) => (
                    <li
                      key={`${component.checkpointNo}-${component.basis}-${index}`}
                      className="flex justify-between gap-3 text-[9px] text-[#697267]"
                    >
                      <span>
                        #{component.checkpointNo} {component.checkpointName} · {component.basis}
                      </span>
                      <span className="shrink-0 font-bold">{component.value}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <InsightList
            title="What is working well"
            description="Only recorded passes, matches and high cosmetic ratings appear here."
            rows={analysis.passedChecks}
            empty="No passed or matched checks have been recorded yet."
            icon={<CheckCircle2 size={16} className="text-[#398653]" />}
            tone="green"
            showOutcome
          />
          <section className="rounded-2xl border border-[#E8E4D9] bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#244A36]">
              <AlertTriangle size={16} className="text-[#D87825]" />
              Issues identified
            </h3>
            <div className="mt-3 space-y-3">
              <InsightList
                title="Critical safety issues"
                rows={analysis.criticalFailures}
                empty="No critical failures recorded."
                tone="red"
                compact
              />
              <InsightList
                title="Other failed checks"
                rows={analysis.otherFailures}
                empty="No other failed checks recorded."
                tone="amber"
                compact
              />
              <InsightList
                title="Cosmetic observations (rating 1–2)"
                rows={analysis.cosmeticIssues}
                empty="No low cosmetic ratings recorded."
                tone="amber"
                compact
                showOutcome
              />
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-[#E8E4D9] bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#244A36]">
            <FileCheck2 size={16} className="text-[#D87825]" />
            Recommended repairs
          </h3>
          <p className="mt-1 text-[10px] leading-5 text-[#92958A]">
            Suggestions are derived only from failed checks or low cosmetic ratings; they are not repair jobs or confirmed work.
          </p>
          {analysis.recommendations.length === 0 ? (
            <p className="mt-3 rounded-lg bg-[#F7F6F1] px-3 py-2 text-xs text-[#697267]">
              No repair recommendations can be made from the results entered so far.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {analysis.recommendations.map((recommendation) => (
                <li
                  key={recommendation.row.checkpoint.checkpoint_no}
                  className="flex flex-col gap-2 rounded-xl bg-[#FCFBF7] p-3 sm:flex-row sm:items-start"
                >
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-extrabold ${priorityClasses[recommendation.priority]}`}
                  >
                    {recommendation.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#344337]">
                      #{recommendation.row.checkpoint.checkpoint_no} ·{" "}
                      {recommendation.row.checkpoint.name}
                    </p>
                    <p className="mt-0.5 text-[9px] text-[#92958A]">
                      SECTION {recommendation.row.sectionLabel} ·{" "}
                      {recommendation.row.sectionName}
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-[#697267]">
                      {recommendation.action}
                    </p>
                    {recommendation.row.assessment.observation && (
                      <p className="mt-1 text-[10px] italic text-[#777D71]">
                        Inspector observation: {recommendation.row.assessment.observation}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#E8E4D9] bg-white p-4">
            <h3 className="text-sm font-bold text-[#244A36]">Pending work</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <CheckpointList
                title={`Unassessed applicable (${unassessedRows.length})`}
                rows={unassessedRows}
                empty="No unassessed applicable checkpoints."
              />
              <CheckpointList
                title={`Assessment incomplete (${inProgressRows.length})`}
                rows={inProgressRows}
                empty="No partial assessments."
              />
              <CheckpointList
                title={`Evidence missing (${missingEvidenceRows.length})`}
                rows={missingEvidenceRows}
                empty="No currently due evidence is missing."
              />
              <CheckpointList
                title={`Applicability to confirm (${unresolvedApplicability.length})`}
                checkpoints={unresolvedApplicability}
                empty="All conditional checks have an applicability decision."
              />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-[#FFF6E9] p-3">
                <p className="text-[10px] font-bold text-[#80643A]">
                  Suggested repairs / outstanding follow-ups ({analysis.recommendations.length})
                </p>
                {analysis.recommendations.length === 0 ? (
                  <p className="mt-1 text-[9px] leading-4 text-[#80643A]">
                    No repair recommendation is supported by the results entered so far.
                  </p>
                ) : (
                  <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
                    {analysis.recommendations.map((recommendation) => (
                      <li
                        key={recommendation.row.checkpoint.checkpoint_no}
                        className="text-[9px] leading-4 text-[#80643A]"
                      >
                        <span className="font-bold">
                          {recommendation.priority} · #
                          {recommendation.row.checkpoint.checkpoint_no}
                        </span>{" "}
                        {recommendation.row.checkpoint.name}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[9px] leading-4 text-[#80643A]">
                  Suggestions only; repair completion is not tracked here.
                </p>
              </div>
              <div className="rounded-xl bg-[#F3F4ED] p-3">
                <p className="text-[10px] font-bold text-[#526052]">
                  QC requirements
                </p>
                <p className="mt-1 text-[9px] leading-4 text-[#526052]">
                  {qcMessage}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E8E4D9] bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#244A36]">
              {safetyStatus === "Blocked" ? (
                <ShieldAlert size={16} className="text-[#B44936]" />
              ) : (
                <ShieldCheck size={16} className="text-[#398653]" />
              )}
              Safety assessment
            </h3>
            <dl className="mt-3 space-y-2 text-xs">
              <SafetyRow label="Workspace safety status" value={safetyStatus} />
              <SafetyRow
                label="Inspection submission"
                value={
                  eligibleForSubmission
                    ? "Eligible"
                    : "Not eligible — checks, evidence or applicability remain"
                }
              />
              <SafetyRow
                label="Safety clearance"
                value={
                  analysis.criticalFailures.length > 0
                    ? "Blocked by critical failures"
                    : finalized
                      ? "Clearance recorded by local demo workflow"
                      : "Pending — inspection is not finalized"
                }
              />
              <SafetyRow
                label="Sale approval"
                value="Never granted by this score or advisor"
              />
            </dl>
            <p className="mt-3 rounded-lg bg-[#F3F4ED] px-3 py-2 text-[10px] leading-5 text-[#526052]">
              Cosmetic ratings do not override critical failures. An incomplete inspection cannot be marked cleared, and this advisor cannot independently approve a vehicle for sale.
            </p>
          </section>
        </div>

        <section className="rounded-2xl border border-[#DDE5D9] bg-[#F5F7F0] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#244A36]">AI Summary</h3>
              <p className="mt-1 text-[9px] font-semibold text-[#92958A]">
                Local, deterministic demo summary · no external AI
              </p>
            </div>
            <button type="button" onClick={copySummary} className={demoSubtleButtonClass}>
              <Clipboard size={14} /> Copy Summary
            </button>
          </div>
          <p className="mt-3 text-xs leading-6 text-[#475448]">{analysis.summary}</p>
          {copyStatus && (
            <p role="status" className="mt-2 text-[10px] text-[#697267]">
              {copyStatus}
            </p>
          )}
          <p className="mt-3 border-t border-[#DFE6D8] pt-3 text-[9px] leading-4 text-[#92958A]">
            {analysisGenerated
              ? `Analysis refreshed locally${analysisGeneratedAt ? ` at ${new Date(analysisGeneratedAt).toLocaleTimeString("en-IN")}` : ""}. Results continue to recalculate whenever checklist data changes.`
              : "Generate analysis to mark this local rule-based review as generated; results recalculate live as data changes."}
          </p>
        </section>
      </div>
    </DemoPanel>
  );
}

function InsightList({
  title,
  description,
  rows,
  empty,
  icon,
  tone,
  compact = false,
  showOutcome = false,
}: {
  title: string;
  description?: string;
  rows: InspectionAnalysisRow[];
  empty: string;
  icon?: ReactNode;
  tone: "green" | "red" | "amber";
  compact?: boolean;
  showOutcome?: boolean;
}) {
  const tones = {
    green: "bg-[#F0F6ED]",
    red: "bg-[#FCF1EE]",
    amber: "bg-[#FFF6E9]",
  };
  return (
    <div className={`rounded-xl ${tones[tone]} ${compact ? "p-3" : "p-4"}`}>
      <h4 className="flex items-center gap-2 text-xs font-bold text-[#344337]">
        {icon}
        {title}
        <span className="text-[9px] text-[#92958A]">({rows.length})</span>
      </h4>
      {description && (
        <p className="mt-1 text-[9px] leading-4 text-[#92958A]">{description}</p>
      )}
      {rows.length === 0 ? (
        <p className="mt-2 text-[10px] text-[#777D71]">{empty}</p>
      ) : (
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <li
              key={row.checkpoint.checkpoint_no}
              className="rounded-lg bg-white/80 px-2.5 py-2"
            >
              <p className="text-[10px] font-semibold text-[#344337]">
                #{row.checkpoint.checkpoint_no} · {row.checkpoint.name}
              </p>
              <p className="text-[9px] text-[#92958A]">
                SECTION {row.sectionLabel} · {row.sectionName}
                {showOutcome && row.assessment.cosmeticScore !== null
                  ? ` · Cosmetic ${row.assessment.cosmeticScore}/5`
                  : ""}
              </p>
              {row.assessment.observation && (
                <p className="mt-1 text-[9px] leading-4 text-[#697267]">
                  {row.assessment.observation}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckpointList({
  title,
  rows,
  checkpoints,
  empty,
}: {
  title: string;
  rows?: InspectionAnalysisRow[];
  checkpoints?: InspectionCheckpoint[];
  empty: string;
}) {
  const count = rows?.length ?? checkpoints?.length ?? 0;
  return (
    <details className="rounded-xl bg-[#F7F6F1] p-3">
      <summary className="cursor-pointer text-[10px] font-bold text-[#526052]">
        {title}
      </summary>
      {count === 0 ? (
        <p className="mt-2 text-[9px] text-[#92958A]">{empty}</p>
      ) : (
        <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
          {rows?.map((row) => (
            <li
              key={row.checkpoint.checkpoint_no}
              className="text-[9px] leading-4 text-[#697267]"
            >
              <span className="font-bold">#{row.checkpoint.checkpoint_no}</span>{" "}
              {row.checkpoint.name} · SECTION {row.sectionLabel} · {row.sectionName}
            </li>
          ))}
          {checkpoints?.map((checkpoint) => (
            <li
              key={checkpoint.checkpoint_no}
              className="text-[9px] leading-4 text-[#697267]"
            >
              <span className="font-bold">#{checkpoint.checkpoint_no}</span>{" "}
              {checkpoint.name} · SECTION {sourceSectionLabels[checkpoint.section_no]} ·{" "}
              {checkpoint.section_name}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function SafetyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-[#F0EEE7] pb-2">
      <dt className="text-[#777D71]">{label}</dt>
      <dd className="text-right font-semibold text-[#344337]">{value}</dd>
    </div>
  );
}
