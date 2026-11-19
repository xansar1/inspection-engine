import Link from "next/link";
import { ArrowLeft, Bike } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type DemoModulePageProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
};

export function DemoModulePage({
  title,
  description,
  icon: Icon,
  children,
}: DemoModulePageProps) {
  return (
    <main className="min-h-screen bg-[#F7F5EF] text-[#26332A]">
      <header className="border-b border-[#E8E3D8] bg-[#FDFCF8]">
        <div className="mx-auto flex min-h-[76px] max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-3 md:px-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#183D2D] text-[#E99A4B]">
              <Bike size={22} />
            </span>
            <span>
              <span className="block text-xs font-extrabold tracking-[1.4px]">
                INSPECTION ENGINE
              </span>
              <span className="mt-1 block text-[9px] font-semibold tracking-[2px] text-[#A27649]">
                TRUST IN EVERY DETAIL
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#FFF0E0] px-3 py-1.5 text-[10px] font-extrabold tracking-[1.5px] text-[#B66A2B]">
              DEMO MODE
            </span>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-[#E8E3D8] bg-white px-3.5 py-2.5 text-xs font-bold text-[#28543D] transition hover:bg-[#F2EFE6]"
            >
              <ArrowLeft size={15} /> Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-7 md:px-8 md:py-9">
        <div className="rounded-2xl bg-[#183D2D] p-6 text-white md:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#E99A4B]">
                <Icon size={24} />
              </span>
              <div>
                <p className="text-[10px] font-bold tracking-[2px] text-[#E99A4B]">
                  WORKSHOP MODULE
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                  {description}
                </p>
              </div>
            </div>
            <p className="max-w-[260px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] leading-5 text-white/70">
              Sample interface and records for demonstration only. No live
              workshop data is displayed.
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

type DemoMetricCardProps = {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  accent?: "green" | "orange" | "amber";
};

export function DemoMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = "green",
}: DemoMetricCardProps) {
  const accentClasses = {
    green: "bg-[#E5F2E5] text-[#25824B]",
    orange: "bg-[#FFF0E0] text-[#D87825]",
    amber: "bg-[#FFF3E4] text-[#C68A32]",
  };

  return (
    <div className="rounded-2xl border border-[#E7E4D9] bg-white p-5 shadow-[0_3px_12px_rgba(40,50,35,0.025)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#72776D]">{label}</p>
        <span className={`rounded-xl p-2.5 ${accentClasses[accent]}`}>
          <Icon size={19} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-[#26332A]">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#92958A]">{detail}</p>
    </div>
  );
}

type DemoPanelProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function DemoPanel({ title, description, children }: DemoPanelProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E8E4D9] bg-white">
      <div className="border-b border-[#F0EEE7] px-5 py-4">
        <h2 className="text-sm font-bold text-[#26332A]">{title}</h2>
        {description && (
          <p className="mt-1 text-xs leading-5 text-[#92958A]">{description}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export const demoButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#E88B35] px-4 py-2.5 text-xs font-bold text-[#17291E] transition hover:bg-[#F3A451] disabled:cursor-not-allowed disabled:opacity-50";

export const demoSubtleButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8E4D9] bg-white px-4 py-2.5 text-xs font-semibold text-[#526052] transition hover:bg-[#F7F5EF]";
