"use client";

import { useState } from "react";
import {
  Bike,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
  demoSubtleButtonClass,
} from "@/app/_components/DemoModuleShell";

const demoVehicles = [
  { id: "DEMO-1024", name: "Honda Activa 6G", registration: "KA 03 MN 4821" },
  { id: "DEMO-1023", name: "Bajaj Pulsar N160", registration: "MH 12 QX 6314" },
  { id: "DEMO-1022", name: "TVS Jupiter 125", registration: "TN 09 CF 2758" },
];

const checklistSections = [
  { id: "visual", title: "Visual condition & identification", points: 24 },
  { id: "engine", title: "Engine & transmission", points: 48 },
  { id: "brakes", title: "Brakes & controls", points: 40 },
  { id: "wheels", title: "Tyres & wheels", points: 28 },
  { id: "suspension", title: "Steering & suspension", points: 32 },
  { id: "electrical", title: "Electrical & lighting", points: 36 },
  { id: "road-test", title: "Road test & performance", points: 32 },
  { id: "documents", title: "Documents & accessories", points: 20 },
];

const inspectionHistory = [
  { id: "INSP-DEMO-018", vehicle: "Honda Activa 6G", date: "19 Nov 2026", status: "In progress" },
  { id: "INSP-DEMO-017", vehicle: "Bajaj Pulsar N160", date: "18 Nov 2026", status: "Completed" },
  { id: "INSP-DEMO-016", vehicle: "TVS Jupiter 125", date: "17 Nov 2026", status: "Awaiting review" },
];

export default function InspectionsPage() {
  const [selectedVehicle, setSelectedVehicle] = useState(demoVehicles[0].id);
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const completedPoints = checklistSections
    .filter((section) => completedSections.includes(section.id))
    .reduce((total, section) => total + section.points, 0);
  const progress = Math.round((completedPoints / 260) * 100);
  const vehicle =
    demoVehicles.find((item) => item.id === selectedVehicle) ?? demoVehicles[0];

  function toggleSection(id: string) {
    setCompletedSections((current) =>
      current.includes(id)
        ? current.filter((sectionId) => sectionId !== id)
        : [...current, id]
    );
  }

  return (
    <DemoModulePage
      title="Vehicle Inspections"
      description="Run the structured 260-point inspection workflow and review demo inspection history."
      icon={ClipboardCheck}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard label="Inspection workflow" value="260 points" detail="Across 8 inspection sections" icon={ScanLine} />
        <DemoMetricCard label="Selected vehicle" value={vehicle.id} detail={vehicle.name} icon={Bike} accent="orange" />
        <DemoMetricCard label="Checklist progress" value={`${progress}%`} detail={`${completedPoints} of 260 demo points`} icon={CheckCircle2} />
        <DemoMetricCard label="Recent inspections" value={inspectionHistory.length} detail="Illustrative history entries" icon={Clock3} accent="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DemoPanel
          title="260-point inspection checklist"
          description="Select a demo vehicle, then mark the sections completed as you walk through the sample workflow."
        >
          <label className="mb-5 block max-w-md">
            <span className="mb-2 block text-xs font-semibold text-[#697267]">
              Vehicle
            </span>
            <select
              value={selectedVehicle}
              onChange={(event) => setSelectedVehicle(event.target.value)}
              className="w-full rounded-xl border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-3 text-sm text-[#344337] outline-none focus:border-[#63866B]"
            >
              {demoVehicles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.registration}
                </option>
              ))}
            </select>
          </label>

          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#475448]">Demo checklist progress</span>
              <span className="font-bold text-[#28543D]">
                {completedPoints} / 260 points
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-[#F0EEE7]"
              role="progressbar"
              aria-label="Demo inspection checklist progress"
              aria-valuenow={completedPoints}
              aria-valuemin={0}
              aria-valuemax={260}
            >
              <div
                className="h-full rounded-full bg-[#398653] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="divide-y divide-[#F0EEE7]">
            {checklistSections.map((section) => {
              const checked = completedSections.includes(section.id);
              return (
                <label
                  key={section.id}
                  className="flex cursor-pointer items-center gap-3 py-3"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSection(section.id)}
                    className="h-4 w-4 accent-[#28543D]"
                  />
                  <span className="min-w-0 flex-1 text-xs font-semibold text-[#475448]">
                    {section.title}
                  </span>
                  <span className="text-[10px] text-[#92958A]">
                    {section.points} points
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EEE7] pt-4">
            <p className="text-[10px] leading-5 text-[#92958A]">
              Checklist changes are temporary demo state only.
            </p>
            <button
              type="button"
              onClick={() => setCompletedSections([])}
              className={demoSubtleButtonClass}
            >
              <RotateCcw size={14} /> Reset checklist
            </button>
          </div>
        </DemoPanel>

        <DemoPanel
          title="Inspection history"
          description="Sample workflow activity for demonstration only."
        >
          <div className="space-y-3">
            {inspectionHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#EEECE5] bg-[#FCFBF7] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[#344337]">
                      {item.vehicle}
                    </p>
                    <p className="mt-1 text-[10px] text-[#92958A]">
                      {item.id} · {item.date}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#EDF3EB] px-2.5 py-1 text-[10px] font-bold text-[#315D40]">
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-[#F3F4ED] p-4 text-xs leading-5 text-[#697267]">
            <span className="font-bold text-[#315D40]">Current demo vehicle:</span>{" "}
            {vehicle.name} · {vehicle.registration}
          </div>
        </DemoPanel>
      </section>
    </DemoModulePage>
  );
}
