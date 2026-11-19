"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
} from "@/app/_components/DemoModuleShell";

type DemoReport = {
  id: string;
  vehicle: string;
  registration: string;
  completed: string;
  rating: number;
  safety: "Cleared" | "Hold";
  criticalIssues: number;
  summary: string[];
};

const demoReports: DemoReport[] = [
  {
    id: "REPORT-DEMO-018",
    vehicle: "Honda Activa 6G · Deluxe",
    registration: "KA 03 MN 4821",
    completed: "19 Nov 2026",
    rating: 4.5,
    safety: "Cleared",
    criticalIssues: 0,
    summary: ["Brakes & tyres: sample pass", "Electrical: sample pass", "Cosmetic: light panel scuff"],
  },
  {
    id: "REPORT-DEMO-017",
    vehicle: "Bajaj Pulsar N160 · Dual Channel ABS",
    registration: "MH 12 QX 6314",
    completed: "18 Nov 2026",
    rating: 4,
    safety: "Cleared",
    criticalIssues: 0,
    summary: ["Brakes & tyres: sample pass", "Engine: sample pass", "Cosmetic: tank touch-up"],
  },
  {
    id: "REPORT-DEMO-016",
    vehicle: "Royal Enfield Classic 350 · Signals Edition",
    registration: "KA 05 PV 7316",
    completed: "17 Nov 2026",
    rating: 3.2,
    safety: "Hold",
    criticalIssues: 1,
    summary: ["Brakes: sample follow-up required", "Suspension: sample pass", "Safety clearance: on hold"],
  },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<DemoReport | null>(null);
  const clearedCount = demoReports.filter((report) => report.safety === "Cleared").length;
  const averageRating =
    demoReports.reduce((total, report) => total + report.rating, 0) /
    demoReports.length;
  const needsFollowUp = demoReports.filter(
    (report) => report.criticalIssues > 0
  ).length;

  return (
    <DemoModulePage
      title="Inspection Reports"
      description="Review sample vehicle reports, condition ratings and safety clearance independently."
      icon={FileText}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard label="Demo reports" value={demoReports.length} detail="Illustrative report records" icon={FileText} />
        <DemoMetricCard label="Safety cleared" value={clearedCount} detail="Sample clearances only" icon={ShieldCheck} />
        <DemoMetricCard label="Follow-up required" value={needsFollowUp} detail="Sample critical issue flags" icon={ShieldAlert} accent="amber" />
        <DemoMetricCard label="Average rating" value={`${averageRating.toFixed(1)} / 5`} detail="Condition rating, not safety clearance" icon={Star} accent="orange" />
      </section>

      <DemoPanel
        title="Vehicle inspection reports"
        description="A demo condition rating does not replace the separate safety clearance decision."
      >
        <div className="space-y-3">
          {demoReports.map((report) => (
            <article
              key={report.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4 lg:flex-row lg:items-center"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wide text-[#A27649]">
                  {report.id} · {report.completed}
                </p>
                <h3 className="mt-1 text-sm font-bold text-[#344337]">
                  {report.vehicle}
                </h3>
                <p className="mt-1 text-[10px] text-[#92958A]">
                  {report.registration}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3EEDC] px-3 py-1.5 text-[11px] font-bold text-[#8A6A20]">
                  <Star size={13} className="fill-current" /> {report.rating.toFixed(1)} / 5
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    report.safety === "Cleared"
                      ? "bg-[#E7F4E6] text-[#26804B]"
                      : "bg-[#FCE9E5] text-[#B44936]"
                  }`}
                >
                  {report.safety === "Cleared" ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <ShieldAlert size={13} />
                  )}
                  Safety {report.safety}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedReport(report)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#244A36] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#345D45]"
                >
                  View report <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </DemoPanel>

      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10271C]/65 p-3 backdrop-blur-sm"
          onClick={() => setSelectedReport(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-preview-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[#FAF9F5] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#E8E3D8] p-5">
              <div>
                <p className="text-[10px] font-extrabold tracking-[1.5px] text-[#A95719]">
                  DEMO REPORT PREVIEW
                </p>
                <h2 id="report-preview-title" className="mt-1 text-lg font-bold text-[#244A36]">
                  {selectedReport.vehicle}
                </h2>
                <p className="mt-1 text-xs text-[#92958A]">
                  {selectedReport.id} · {selectedReport.registration}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                aria-label="Close report preview"
                className="rounded-lg p-2 text-[#697267] transition hover:bg-[#EEEDE4]"
              >
                <X size={19} />
              </button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <ReportValue label="Condition rating" value={`${selectedReport.rating.toFixed(1)} / 5`} />
                <ReportValue label="Safety clearance" value={selectedReport.safety} />
                <ReportValue label="Critical issues" value={selectedReport.criticalIssues} />
                <ReportValue label="Inspection date" value={selectedReport.completed} />
              </div>
              <h3 className="mb-3 mt-6 text-sm font-bold text-[#244A36]">
                Report summary
              </h3>
              <ul className="space-y-2">
                {selectedReport.summary.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg bg-white px-3 py-2.5 text-xs text-[#526052]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[10px] leading-5 text-[#92958A]">
                Fictional demo report. This preview is not an actual inspection record.
              </p>
            </div>
          </div>
        </div>
      )}
    </DemoModulePage>
  );
}

function ReportValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[#F0F1E9] p-3">
      <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#344337]">{value}</p>
    </div>
  );
}
