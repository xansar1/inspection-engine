"use client";

import Image from "next/image";
import {
  CircleHelp,
  MapPin,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import {
  hasRequiredEvidence,
  isAssessmentComplete,
  isAssessmentStarted,
  isCriticalFailure,
  type CheckpointAssessment,
  type InspectionCheckpoint,
} from "./checklist-model";

export type LocalEvidence = {
  id: string;
  name: string;
  mediaType: "photo" | "video";
  previewUrl: string;
  file?: File;
  storagePath?: string;
  databaseId?: string;
};

export type WorkshopMechanic = {
  id: string;
  name: string;
};

type CheckpointAssessmentCardProps = {
  checkpoint: InspectionCheckpoint;
  assessment: CheckpointAssessment;
  applicable: boolean | null | undefined;
  applicabilityAuthorized: boolean;
  autoValue: string;
  evidence: LocalEvidence[];
  disabled: boolean;
  selectedMechanic: string;
  mechanics: WorkshopMechanic[];
  locationMessage: string;
  locationCapturing: boolean;
  canAuthorizeNotApplicable: boolean;
  authorizingNotApplicable: boolean;
  onAssessmentChange: (changes: Partial<CheckpointAssessment>) => void;
  onApplicabilityChange: (applicable: boolean | null) => void;
  onAuthorizeNotApplicable: () => void;
  onMechanicChange: (mechanicId: string) => void;
  onCaptureLocation: () => void;
  onEvidenceSelected: (
    mediaType: "photo" | "video",
    files: FileList | null
  ) => void;
  onRemoveEvidence: (evidenceId: string) => void;
};

const fieldClass =
  "w-full rounded-xl border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-2.5 text-xs text-[#344337] outline-none focus:border-[#63866B] disabled:cursor-not-allowed disabled:opacity-60";

function isPassFailStatus(status: CheckpointAssessment["resultStatus"]) {
  return status === "pass" || status === "fail";
}

export default function CheckpointAssessmentCard({
  checkpoint,
  assessment,
  applicable,
  applicabilityAuthorized,
  autoValue,
  evidence,
  disabled,
  selectedMechanic,
  mechanics,
  locationMessage,
  locationCapturing,
  canAuthorizeNotApplicable,
  authorizingNotApplicable,
  onAssessmentChange,
  onApplicabilityChange,
  onAuthorizeNotApplicable,
  onMechanicChange,
  onCaptureLocation,
  onEvidenceSelected,
  onRemoveEvidence,
}: CheckpointAssessmentCardProps) {
  const method = checkpoint.assessment_method;
  const isMixed = checkpoint.classification === "Mixed";
  const needsRating = method.startsWith("1–5 scale");
  const needsMeasurement =
    method === "Measured" ||
    method === "Measured vs spec" ||
    method === "Age vs threshold" ||
    method === "Pass/Fail (wear threshold)";
  const needsExpectedValue =
    method === "Measured vs spec" ||
    method === "Age vs threshold" ||
    method === "Pass/Fail (wear threshold)";
  const needsPassFail =
    method.includes("Pass/Fail") ||
    method === "Tamper check" ||
    method === "Match + tamper check" ||
    needsExpectedValue;
  const needsMatch = method.includes("Match");
  const isNotApplicable =
    checkpoint.is_conditional &&
    applicable === false &&
    assessment.resultStatus === "not_applicable";
  const assessmentComplete = isAssessmentComplete(
    checkpoint,
    assessment,
    applicable,
    autoValue
  );
  const assessmentStarted = isAssessmentStarted(
    checkpoint,
    assessment,
    applicable,
    autoValue
  );
  const evidenceComplete = hasRequiredEvidence(checkpoint.evidence_required, evidence);
  const complete =
    assessmentComplete &&
    (isNotApplicable ? applicabilityAuthorized : evidenceComplete);
  const criticalFailure = isCriticalFailure(checkpoint, assessment);
  const statusLabel = criticalFailure
    ? "Critical failure"
    : isNotApplicable
      ? applicabilityAuthorized
        ? "N/A authorized"
        : "Awaiting admin approval"
      : checkpoint.is_conditional && applicable !== true
        ? "Applicability required"
      : complete
        ? "Complete"
        : "Unassessed";
  const statusClass = criticalFailure
    ? "bg-[#FCE9E5] text-[#B44936]"
    : complete
      ? "bg-[#E7F4E6] text-[#26804B]"
      : "bg-[#F3F0E7] text-[#777D71]";
  const requiresPhoto =
    checkpoint.evidence_required === "Photo" ||
    checkpoint.evidence_required === "Photo+Video";
  const requiresVideo =
    checkpoint.evidence_required === "Video" ||
    checkpoint.evidence_required === "Photo+Video";
  const hasEvidenceRequirement = requiresPhoto || requiresVideo;
  const evidenceDue =
    hasEvidenceRequirement &&
    (assessmentStarted || assessment.evidenceDue) &&
    (!checkpoint.is_conditional || applicable === true);
  const controlsDisabled = disabled || (checkpoint.is_conditional && applicable !== true);

  function handlePassFail(value: string) {
    if (value !== "pass" && value !== "fail") {
      onAssessmentChange({ resultStatus: null });
      return;
    }
    onAssessmentChange({ resultStatus: value });
  }

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        criticalFailure
          ? "border-[#EBC4BA]"
          : complete
            ? "border-[#DDE8DC]"
            : "border-[#E8E4D9]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#F3F0E7] px-2 text-xs font-extrabold text-[#315D40]">
            {checkpoint.checkpoint_no}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-5 text-[#26332A]">
              {checkpoint.name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#F2EFE6] px-2.5 py-1 text-[9px] font-bold text-[#697267]">
                {checkpoint.classification}
              </span>
              <span className="text-[10px] text-[#92958A]">
                {method}
              </span>
            </div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      {checkpoint.is_conditional && (
        <div className="mt-4 rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-3">
          <label className="block">
          <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#697267]">
            <CircleHelp size={13} /> Applicable / equipped?
          </span>
          <select
            value={
              applicable === true ? "yes" : applicable === false ? "no" : ""
            }
            onChange={(event) => {
              const value = event.target.value;
              onApplicabilityChange(
                value === "yes" ? true : value === "no" ? false : null
              );
            }}
            disabled={disabled}
            className={fieldClass}
          >
            <option value="">Select applicability before assessment</option>
            <option value="yes">Yes — assess this checkpoint</option>
            <option value="no">No — Not Applicable</option>
          </select>
          </label>
          {applicable === false && (
            <div className="mt-3 space-y-2">
              <label className="block text-[10px] font-bold text-[#697267]">
                Inspector reason (required)
                <textarea
                  value={assessment.applicabilityReason}
                  onChange={(event) =>
                    onAssessmentChange({
                      applicabilityReason: event.target.value,
                    })
                  }
                  disabled={disabled}
                  maxLength={500}
                  rows={2}
                  className={`${fieldClass} mt-1`}
                  placeholder="Explain why this conditional checkpoint does not apply"
                />
              </label>
              <p className="text-[10px] leading-4 text-[#8A6A3F]">
                Not-applicable decisions require an active admin authorization before submission.
              </p>
              {canAuthorizeNotApplicable && (
                <button
                  type="button"
                  onClick={onAuthorizeNotApplicable}
                  disabled={
                    disabled ||
                    authorizingNotApplicable ||
                    applicabilityAuthorized ||
                    assessment.applicabilityReason.trim().length < 10
                  }
                  className="rounded-lg bg-[#315D40] px-3 py-2 text-[10px] font-bold text-white transition hover:bg-[#244A31] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authorizingNotApplicable
                    ? "Authorizing..."
                    : applicabilityAuthorized
                      ? "Admin authorized"
                      : "Authorize not applicable"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!isNotApplicable && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {method.startsWith("Auto-") ? (
            <div className="rounded-xl bg-[#F3F4ED] p-3 sm:col-span-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
                Automatically captured value
              </p>
              <p className="mt-1 break-words text-xs font-semibold text-[#344337]">
                {autoValue || "Not captured"}
              </p>
              {(checkpoint.checkpoint_no === 16 ||
                checkpoint.checkpoint_no === 17) && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={onCaptureLocation}
                    disabled={disabled || locationCapturing}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#DDE3D8] bg-white px-3 py-2 text-[10px] font-bold text-[#315D40] transition hover:bg-[#F7F6F1] disabled:opacity-50"
                  >
                    <MapPin size={13} />
                    {locationCapturing ? "Capturing location..." : "Capture GPS location"}
                  </button>
                  {locationMessage && (
                    <p className="mt-2 text-[10px] text-[#697267]" role="status">
                      {locationMessage}
                    </p>
                  )}
                  <p className="mt-1 text-[9px] leading-4 text-[#92958A]">
                    GPS is requested only when you choose to capture it and is saved with the inspection.
                  </p>
                </div>
              )}
              {checkpoint.checkpoint_no === 18 && (
                <label className="mt-3 block max-w-sm">
                  <span className="mb-1.5 block text-[10px] font-semibold text-[#697267]">
                    Assigned mechanic
                  </span>
                  <select
                    value={selectedMechanic}
                    onChange={(event) => onMechanicChange(event.target.value)}
                    disabled={disabled}
                    className={fieldClass}
                  >
                    <option value="">Select a workshop mechanic</option>
                    {mechanics.map((mechanic) => (
                      <option key={mechanic.id} value={mechanic.id}>
                        {mechanic.id} · {mechanic.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ) : (
            <>
              {needsRating && (
                <Field label={`Cosmetic rating${isMixed ? " (cosmetic portion)" : ""}`}>
                  <select
                    value={assessment.cosmeticScore ?? ""}
                    onChange={(event) =>
                      onAssessmentChange({
                        cosmeticScore: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    disabled={controlsDisabled}
                    className={fieldClass}
                  >
                    <option value="">Select 1–5</option>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <option key={score} value={score}>
                        {score}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {needsMeasurement && (
                <>
                  <Field label="Measured value">
                    <input
                      type="number"
                      step="any"
                      value={assessment.measuredValue}
                      onChange={(event) =>
                        onAssessmentChange({ measuredValue: event.target.value })
                      }
                      disabled={controlsDisabled}
                      className={fieldClass}
                      placeholder="Enter observed value"
                    />
                  </Field>
                  <Field label="Unit">
                    <input
                      value={assessment.measuredUnit}
                      onChange={(event) =>
                        onAssessmentChange({ measuredUnit: event.target.value })
                      }
                      disabled={controlsDisabled}
                      className={fieldClass}
                      placeholder="Enter unit"
                    />
                  </Field>
                </>
              )}

              {needsExpectedValue && (
                <Field label="Reference specification / threshold">
                  <input
                    value={assessment.expectedValue}
                    onChange={(event) =>
                      onAssessmentChange({ expectedValue: event.target.value })
                    }
                    disabled={controlsDisabled}
                    className={fieldClass}
                    placeholder="Enter applicable spec; no threshold is assumed"
                  />
                </Field>
              )}

              {needsMatch && (
                <Field label="Match assessment">
                  <select
                    value={assessment.matchStatus ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      onAssessmentChange({
                        matchStatus:
                          value === "match" || value === "mismatch"
                            ? value
                            : null,
                      });
                    }}
                    disabled={controlsDisabled}
                    className={fieldClass}
                  >
                    <option value="">Select Match / Mismatch</option>
                    <option value="match">Match</option>
                    <option value="mismatch">Mismatch</option>
                  </select>
                </Field>
              )}

              {needsPassFail && (
                <Field
                  label={
                    needsExpectedValue
                      ? "Assessment against entered specification"
                      : method === "Match + tamper check"
                        ? "Tamper check"
                        : "Assessment"
                  }
                >
                  <select
                    value={isPassFailStatus(assessment.resultStatus) ? assessment.resultStatus : ""}
                    onChange={(event) => handlePassFail(event.target.value)}
                    disabled={controlsDisabled}
                    className={fieldClass}
                  >
                    <option value="">Select Pass / Fail</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                </Field>
              )}

              {method.includes("count logged") && (
                <Field label="Count observed">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={assessment.countValue}
                    onChange={(event) =>
                      onAssessmentChange({ countValue: event.target.value })
                    }
                    disabled={controlsDisabled}
                    className={fieldClass}
                    placeholder="Enter count"
                  />
                </Field>
              )}

              {method === "Present/Absent" && (
                <Field label="Observed presence">
                  <select
                    value={assessment.recordedValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      const critical = checkpoint.classification === "Critical";
                      onAssessmentChange({
                        recordedValue: value,
                        resultStatus: critical
                          ? value === "Present"
                            ? "pass"
                            : value === "Absent"
                              ? "fail"
                              : null
                          : value
                            ? "recorded"
                            : null,
                      });
                    }}
                    disabled={controlsDisabled}
                    className={fieldClass}
                  >
                    <option value="">Select Present / Absent</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                  </select>
                </Field>
              )}

              {method === "Disclosed / Undisclosed" && (
                <Field label="Disclosure status">
                  <select
                    value={
                      assessment.isDisclosed === null
                        ? ""
                        : assessment.isDisclosed
                          ? "disclosed"
                          : "undisclosed"
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      const isDisclosed =
                        value === "disclosed"
                          ? true
                          : value === "undisclosed"
                            ? false
                            : null;
                      onAssessmentChange({
                        isDisclosed,
                        recordedValue: isDisclosed === null
                          ? ""
                          : isDisclosed
                            ? "Disclosed"
                            : "Undisclosed",
                      });
                    }}
                    disabled={controlsDisabled}
                    className={fieldClass}
                  >
                    <option value="">Select disclosure status</option>
                    <option value="disclosed">Disclosed</option>
                    <option value="undisclosed">Undisclosed</option>
                  </select>
                </Field>
              )}

              {method === "Recorded" && (
                <Field label="Recorded value">
                  <input
                    value={assessment.recordedValue}
                    onChange={(event) =>
                      onAssessmentChange({ recordedValue: event.target.value })
                    }
                    disabled={controlsDisabled}
                    className={fieldClass}
                    placeholder="Enter the observed value"
                  />
                </Field>
              )}
            </>
          )}
        </div>
      )}

      {criticalFailure && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[10px] font-semibold text-[#9F4A3A]">
            Critical issue notes (optional)
          </span>
          <textarea
            value={assessment.issueDescription}
            onChange={(event) =>
              onAssessmentChange({ issueDescription: event.target.value })
            }
            disabled={disabled}
            rows={2}
            className={`${fieldClass} resize-y`}
            placeholder="Describe the observed failure without inferring other results"
          />
        </label>
      )}

      {checkpoint.classification === "Mixed" && (
        <p className="mt-3 rounded-lg bg-[#F7F5EF] px-3 py-2 text-[10px] leading-5 text-[#697267]">
          Record both the cosmetic rating and the separate critical Pass / Fail assessment. Cosmetic rating does not change safety status.
        </p>
      )}

      {checkpoint.is_conditional && applicable === false && (
        <p className="mt-3 rounded-lg bg-[#F3F4ED] px-3 py-2 text-[10px] font-semibold text-[#697267]">
          Recorded as Not Applicable based on the selected equipment/applicability response.
        </p>
      )}

      {!isNotApplicable ? (
      <div className="mt-4 border-t border-[#F0EEE7] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#697267]">
            Evidence required: {checkpoint.evidence_required}
          </p>
              {!hasEvidenceRequirement && (
                <span className="text-[10px] text-[#92958A]">No media required</span>
          )}
        </div>

            {hasEvidenceRequirement && (
              <label className="mt-2 inline-flex items-center gap-2 text-[10px] text-[#697267]">
                <input
                  type="checkbox"
                  checked={assessment.evidenceDue || assessmentStarted}
                  onChange={(event) =>
                    onAssessmentChange({ evidenceDue: event.target.checked })
                  }
                  disabled={controlsDisabled || assessmentStarted}
                  className="h-3.5 w-3.5 accent-[#28543D]"
                />
                Evidence is due now
              </label>
            )}

        {(requiresPhoto || requiresVideo) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {requiresPhoto && (
              <EvidencePicker
                label="Photo evidence"
                mediaType="photo"
                evidence={evidence.filter((item) => item.mediaType === "photo")}
                disabled={controlsDisabled}
                onSelected={(files) => onEvidenceSelected("photo", files)}
                onRemove={onRemoveEvidence}
              />
            )}
            {requiresVideo && (
              <EvidencePicker
                label="Video evidence"
                mediaType="video"
                evidence={evidence.filter((item) => item.mediaType === "video")}
                disabled={controlsDisabled}
                onSelected={(files) => onEvidenceSelected("video", files)}
                onRemove={onRemoveEvidence}
              />
            )}
          </div>
        )}
        {evidenceDue && !evidenceComplete && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#A95719]">
            <ShieldAlert size={13} /> Required evidence is missing.
          </p>
        )}
        {hasEvidenceRequirement && !evidenceDue && (
          <p className="mt-2 text-[9px] text-[#92958A]">
            Missing evidence is counted after assessment begins or evidence is marked due.
          </p>
        )}
        <p className="mt-2 text-[9px] leading-4 text-[#92958A]">
          Selected evidence uploads to private inspection storage when progress is saved.
        </p>
      </div>
      ) : (
        <p className="mt-4 border-t border-[#F0EEE7] pt-4 text-[10px] text-[#92958A]">
          Evidence is not required for a checkpoint recorded as Not Applicable.
        </p>
      )}

      {!isNotApplicable && (
        <Field label="Inspector observations (optional)">
          <textarea
            value={assessment.observation}
            onChange={(event) =>
              onAssessmentChange({ observation: event.target.value })
            }
            disabled={controlsDisabled}
            rows={2}
            className={`${fieldClass} mt-1 resize-y`}
            placeholder="Record observations in the inspector's own words"
          />
        </Field>
      )}
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold text-[#697267]">
        {label}
      </span>
      {children}
    </label>
  );
}

function EvidencePicker({
  label,
  mediaType,
  evidence,
  disabled,
  onSelected,
  onRemove,
}: {
  label: string;
  mediaType: "photo" | "video";
  evidence: LocalEvidence[];
  disabled: boolean;
  onSelected: (files: FileList | null) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#DCD9CD] bg-[#FCFBF7] p-3">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-[10px] font-bold text-[#315D40] shadow-sm transition hover:bg-[#F3F4ED]">
        <Upload size={13} />
        {label}
        <input
          type="file"
          accept={mediaType === "photo" ? "image/*" : "video/*"}
          multiple
          disabled={disabled}
          onChange={(event) => {
            onSelected(event.target.files);
            event.currentTarget.value = "";
          }}
          className="sr-only"
        />
      </label>
      {evidence.length > 0 && (
        <ul className="mt-3 space-y-2">
          {evidence.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg bg-white p-2"
            >
              {item.mediaType === "photo" ? (
                <Image
                  src={item.previewUrl}
                  alt={`Local evidence preview: ${item.name}`}
                  width={54}
                  height={42}
                  unoptimized
                  className="h-10 w-14 rounded object-cover"
                />
              ) : (
                <video
                  src={item.previewUrl}
                  controls
                  className="h-10 w-14 rounded bg-black object-cover"
                  aria-label={`Local video evidence preview: ${item.name}`}
                />
              )}
              <span className="min-w-0 flex-1 truncate text-[9px] text-[#697267]">
                {item.name}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                disabled={disabled}
                aria-label={`Remove ${item.name}`}
                className="rounded p-1 text-[#92958A] hover:bg-[#F3F0E7] hover:text-[#9F4A3A]"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
