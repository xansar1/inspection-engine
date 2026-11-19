"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
  demoButtonClass,
  demoSubtleButtonClass,
} from "@/app/_components/DemoModuleShell";

type DemoQcJob = {
  id: string;
  vehicle: string;
  registration: string;
  itemsToVerify: string[];
  verifiedItems: string[];
  status: "Pending QC" | "Approved" | "Rejected";
};

const initialJobs: DemoQcJob[] = [
  {
    id: "QC-DEMO-205",
    vehicle: "Honda Activa 6G",
    registration: "KA 03 MN 4821",
    itemsToVerify: ["Front brake response", "Tyre tread and pressure"],
    verifiedItems: [],
    status: "Pending QC",
  },
  {
    id: "QC-DEMO-204",
    vehicle: "Bajaj Pulsar N160",
    registration: "MH 12 QX 6314",
    itemsToVerify: ["Rear brake alignment"],
    verifiedItems: [],
    status: "Pending QC",
  },
  {
    id: "QC-DEMO-203",
    vehicle: "TVS Jupiter 125",
    registration: "TN 09 CF 2758",
    itemsToVerify: ["Electrical connector fitment"],
    verifiedItems: ["Electrical connector fitment"],
    status: "Approved",
  },
];

export default function QualityControlPage() {
  const [jobs, setJobs] = useState(initialJobs);
  const pendingCount = jobs.filter((job) => job.status === "Pending QC").length;
  const approvedCount = jobs.filter((job) => job.status === "Approved").length;
  const rejectedCount = jobs.filter((job) => job.status === "Rejected").length;
  const verifiedCount = jobs.reduce(
    (total, job) => total + job.verifiedItems.length,
    0
  );

  function toggleVerification(jobId: string, item: string) {
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== jobId) return job;
        const verifiedItems = job.verifiedItems.includes(item)
          ? job.verifiedItems.filter((verified) => verified !== item)
          : [...job.verifiedItems, item];
        return { ...job, verifiedItems };
      })
    );
  }

  function setJobStatus(jobId: string, status: "Approved" | "Rejected") {
    setJobs((current) =>
      current.map((job) => (job.id === jobId ? { ...job, status } : job))
    );
  }

  return (
    <DemoModulePage
      title="Quality Control"
      description="Re-inspect completed demo repairs, verify safety-critical items, then approve or return a job."
      icon={ShieldCheck}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard label="Awaiting QC" value={pendingCount} detail="Demo jobs to review" icon={ClipboardCheck} accent="amber" />
        <DemoMetricCard label="Approved" value={approvedCount} detail="Approved demo reviews" icon={CheckCircle2} />
        <DemoMetricCard label="Returned for repair" value={rejectedCount} detail="Rejected demo reviews" icon={XCircle} accent="orange" />
        <DemoMetricCard label="Verification checks" value={verifiedCount} detail="Sample safety items verified" icon={TriangleAlert} accent="orange" />
      </section>

      <DemoPanel
        title="Re-inspection queue"
        description="Demo checklist entries illustrate verification only. Approval is available after every listed critical item is checked."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {jobs.map((job) => {
            const allVerified = job.itemsToVerify.every((item) =>
              job.verifiedItems.includes(item)
            );
            const statusClass =
              job.status === "Approved"
                ? "bg-[#E7F4E6] text-[#26804B]"
                : job.status === "Rejected"
                  ? "bg-[#FCE9E5] text-[#B44936]"
                  : "bg-[#FFF3E4] text-[#9A7026]";

            return (
              <article
                key={job.id}
                className="rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-wide text-[#A27649]">
                      {job.id}
                    </p>
                    <h3 className="mt-1 text-sm font-bold text-[#344337]">
                      {job.vehicle}
                    </h3>
                    <p className="mt-1 text-[10px] text-[#92958A]">
                      {job.registration}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>
                    {job.status}
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-[#E8E3D8] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#697267]">
                    Re-inspection · critical issue verification
                  </p>
                  <div className="mt-3 space-y-3">
                    {job.itemsToVerify.map((item) => (
                      <label key={item} className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={job.verifiedItems.includes(item)}
                          onChange={() => toggleVerification(job.id, item)}
                          disabled={job.status !== "Pending QC"}
                          className="mt-0.5 h-4 w-4 accent-[#28543D]"
                        />
                        <span className="text-xs leading-5 text-[#475448]">
                          Verify correction: {item}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {job.status === "Pending QC" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setJobStatus(job.id, "Approved")}
                      disabled={!allVerified}
                      className={demoButtonClass}
                      title={
                        allVerified
                          ? "Approve verified demo repair"
                          : "Verify every listed item before approval"
                      }
                    >
                      <CheckCircle2 size={14} /> Approve QC
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobStatus(job.id, "Rejected")}
                      className={demoSubtleButtonClass}
                    >
                      <XCircle size={14} /> Reject / return for repair
                    </button>
                    {!allVerified && (
                      <p className="w-full text-[10px] text-[#9A7026]">
                        All critical verification items must be checked before approval.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-xs font-semibold text-[#526052]">
                    Demo QC decision: {job.status}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </DemoPanel>
    </DemoModulePage>
  );
}
