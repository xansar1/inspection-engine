
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Bike, ClipboardCheck, Wrench, ShieldCheck,
  FileText, Users, Settings, Search, Bell, ArrowRight,
  Clock3, CheckCircle2, AlertTriangle, Plus, Activity,
  Menu, Gauge, X, ScanLine, Home
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid
} from "recharts";
import AuthControls from "@/app/_components/AuthControls";
import { createClient } from "@/lib/supabase/client";

type Vehicle = {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  variant: string | null;
  vehicle_type: string | null;
  created_at: string;
};

type Inspection = {
  id: string;
  vehicle_id: string;
  status: string;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type RepairJob = {
  id: string;
  inspection_id: string;
  status: string;
};

type Rating = {
  inspection_id: string;
  sale_ready: boolean;
  safety_clearance: string;
  critical_failures: number;
};

const navGroups = [
  {
    label: "MAIN",
    items: [
      { name: "Home Page", icon: Home, href: "/" },
      { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    label: "OVERVIEW",
    items: [
      { name: "Vehicles", icon: Bike, href: "/vehicles" },
      { name: "Inspections", icon: ClipboardCheck, href: "/inspections" },
    ],
  },
  {
    label: "WORKSHOP",
    items: [
      { name: "Repair Management", icon: Wrench, href: "/repairs" },
      { name: "Quality Control", icon: ShieldCheck, href: "/quality-control" },
      { name: "Team Members", icon: Users, href: "/team" },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { name: "Reports", icon: FileText, href: "/reports" },
      { name: "Settings", icon: Settings, href: "/settings" },
    ],
  },
];

const statusStyle: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  orange: "bg-orange-100 text-orange-800",
  blue: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800",
};

function getVehicleStatus(
  vehicleId: string,
  inspections: Inspection[],
  repairs: RepairJob[],
  ratings: Rating[]
) {
  const latest = inspections
    .filter((i) => i.vehicle_id === vehicleId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )[0];

  if (!latest) {
    return { label: "Registered", color: "blue" };
  }

  if (ratings.some(
    (r) =>
      r.inspection_id === latest.id &&
      r.sale_ready === true &&
      r.safety_clearance === "cleared" &&
      r.critical_failures === 0
  )) {
    return { label: "Ready for Sale", color: "green" };
  }

  if (latest.status === "repair_required") {
    return { label: "Under Repair", color: "orange" };
  }

  if (latest.status === "submitted" || latest.status === "qc_pending") {
    return { label: "Quality Control", color: "purple" };
  }

  if (latest.status === "draft" || latest.status === "in_progress") {
    return { label: "Inspection", color: "blue" };
  }

  if (latest.status === "approved") {
    return { label: "Approved", color: "green" };
  }

  if (latest.status === "rejected") {
    return { label: "Rejected", color: "orange" };
  }

  const activeRepair = repairs.some(
    (r) =>
      r.inspection_id === latest.id &&
      ["pending", "assigned", "in_progress"].includes(r.status)
  );

  if (activeRepair) {
    return { label: "Under Repair", color: "orange" };
  }

  return { label: latest.status.replaceAll("_", " "), color: "blue" };
}

function timeAgo(value: string | null) {
  if (!value) return "Time unavailable";

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  );

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export default function Dashboard() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [period, setPeriod] = useState("This Week");
  const [search, setSearch] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [repairs, setRepairs] = useState<RepairJob[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        vehiclesResult,
        inspectionsResult,
        repairsResult,
        ratingsResult,
      ] = await Promise.all([
        supabase
          .from("vehicles")
          .select(
            "id, registration_number, make, model, variant, vehicle_type, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("inspections")
          .select(
            "id, vehicle_id, status, started_at, submitted_at, completed_at, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("repair_jobs")
          .select("id, inspection_id, status"),

        supabase
          .from("vehicle_ratings")
          .select(
            "inspection_id, sale_ready, safety_clearance, critical_failures"
          ),
      ]);

      if (vehiclesResult.error) throw vehiclesResult.error;
      if (inspectionsResult.error) throw inspectionsResult.error;
      if (repairsResult.error) throw repairsResult.error;

      setVehicles((vehiclesResult.data ?? []) as Vehicle[]);
      setInspections((inspectionsResult.data ?? []) as Inspection[]);
      setRepairs((repairsResult.data ?? []) as RepairJob[]);

      // Vehicle ratings are restricted by RLS for some roles.
      // An empty result is not treated as an error.
      setRatings((ratingsResult.data ?? []) as Rating[]);
    } catch (err) {
      console.error("Dashboard load failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Dashboard data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const completedInspections = inspections.filter(
    (i) =>
      ["submitted", "repair_required", "qc_pending", "approved", "rejected"]
        .includes(i.status) ||
      Boolean(i.submitted_at)
  );

  const activeRepairVehicleIds = new Set(
    repairs
      .filter((r) =>
        ["pending", "assigned", "in_progress"].includes(r.status)
      )
      .map((r) => {
        return inspections.find((i) => i.id === r.inspection_id)?.vehicle_id;
      })
      .filter(Boolean)
  );

  const readyVehicleIds = new Set(
    ratings
      .filter(
        (r) =>
          r.sale_ready === true &&
          r.safety_clearance === "cleared" &&
          r.critical_failures === 0
      )
      .map((r) => {
        return inspections.find((i) => i.id === r.inspection_id)?.vehicle_id;
      })
      .filter(Boolean)
  );

  const pipeline = useMemo(() => {
    const latestByVehicle = new Map<string, Inspection>();

    for (const inspection of inspections) {
      const previous = latestByVehicle.get(inspection.vehicle_id);

      if (
        !previous ||
        new Date(inspection.created_at).getTime() >
          new Date(previous.created_at).getTime()
      ) {
        latestByVehicle.set(inspection.vehicle_id, inspection);
      }
    }

    const result = {
      inspection: 0,
      repair: 0,
      qc: 0,
      ready: 0,
    };

    for (const [vehicleId, inspection] of latestByVehicle) {
      if (readyVehicleIds.has(vehicleId)) {
        result.ready++;
      } else if (inspection.status === "repair_required") {
        result.repair++;
      } else if (
        ["submitted", "qc_pending"].includes(inspection.status)
      ) {
        result.qc++;
      } else if (
        ["draft", "in_progress"].includes(inspection.status)
      ) {
        result.inspection++;
      }
    }

    return result;
  }, [inspections, readyVehicleIds]);

  const chartData = useMemo(() => {
    const now = new Date();
    const days = period === "This Week" ? 7 : period === "This Month" ? 30 : 365;
    const start = new Date(now);
    start.setDate(now.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    const buckets = new Map<string, number>();

    if (period === "This Week") {
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        buckets.set(
          date.toLocaleDateString("en", { weekday: "short" }),
          0
        );
      }
    } else if (period === "This Month") {
      for (let i = 0; i < 5; i++) buckets.set(`Week ${i + 1}`, 0);
    } else {
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        buckets.set(
          date.toLocaleDateString("en", { month: "short" }),
          0
        );
      }
    }

    for (const inspection of inspections) {
      const value = inspection.submitted_at || inspection.completed_at;
      if (!value) continue;

      const date = new Date(value);
      if (date < start || date > now) continue;

      let key: string;

      if (period === "This Week") {
        key = date.toLocaleDateString("en", { weekday: "short" });
      } else if (period === "This Month") {
        const week = Math.min(5, Math.ceil(date.getDate() / 7));
        key = `Week ${week}`;
      } else {
        key = date.toLocaleDateString("en", { month: "short" });
      }

      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return Array.from(buckets, ([day, inspections]) => ({
      day,
      inspections,
    }));
  }, [inspections, period]);

  const recentVehicles = vehicles
    .filter((v) =>
      `${v.make} ${v.model} ${v.registration_number}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .slice(0, 5);

  const recentInspections = [...inspections]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 4);

  const stats = [
    {
      label: "Total Vehicles",
      value: vehicles.length,
      icon: Bike,
      color: "green",
    },
    {
      label: "Inspections Done",
      value: completedInspections.length,
      icon: ClipboardCheck,
      color: "orange",
    },
    {
      label: "Under Repair",
      value: activeRepairVehicleIds.size,
      icon: Wrench,
      color: "amber",
    },
    {
      label: "Ready for Sale",
      value: readyVehicleIds.size,
      icon: ShieldCheck,
      color: "green",
    },
  ];

  const pipelineItems = [
    {
      label: "Inspection",
      count: pipeline.inspection,
      color: "bg-blue-500",
    },
    {
      label: "Under Repair",
      count: pipeline.repair,
      color: "bg-[#E88B35]",
    },
    {
      label: "Quality Control",
      count: pipeline.qc,
      color: "bg-purple-500",
    },
    {
      label: "Ready for Sale",
      count: pipeline.ready,
      color: "bg-green-500",
    },
  ];

  const pipelineTotal = pipelineItems.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#26332A]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[255px] flex-col bg-[#183D2D] text-white transition-transform duration-300 lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[94px] items-center justify-between border-b border-white/10 px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E88B35] text-[#183D2D]">
              <Gauge size={26} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[15px] font-extrabold tracking-[1px]">
                INSPECTION
              </div>
              <div className="text-[11px] font-bold tracking-[5px] text-[#E99A4B]">
                ENGINE
              </div>
              <div className="mt-1 text-[9px] text-white/50">
                Vehicle Inspection & Workshop
              </div>
            </div>
          </Link>
          <button onClick={() => setMenuOpen(false)} className="lg:hidden">
            <X size={21} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-7">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-8">
              <p className="mb-3 px-3 text-[10px] font-bold tracking-[2px] text-white/40">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] transition-all ${
                        active
                          ? "bg-[#F2E6D2] font-bold text-[#203A2B]"
                          : "text-white/75 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <item.icon size={18} />
                      {item.name}
                      {active && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-[#D98232]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="m-4 overflow-hidden rounded-2xl border border-white/15 bg-[#254B38]">
          <img
            src="https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=85"
            alt="Motorcycle workshop"
            className="h-[105px] w-full object-cover"
          />
          <div className="p-4">
            <div className="text-sm font-bold">Start a New Inspection</div>
            <p className="mt-2 text-[11px] leading-5 text-white/60">
              Complete 260-point inspection for accurate vehicle health.
            </p>
            <Link
              href="/inspections"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#E88B35] py-2.5 text-xs font-bold text-[#17291E] hover:bg-[#F3A451]"
            >
              New Inspection <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <main className="min-h-screen lg:ml-[255px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#E9E4D9] bg-[#FDFCF8]/95 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-lg p-2 hover:bg-[#EEEAE0] lg:hidden"
            >
              <Menu size={21} />
            </button>
            <div className="text-sm font-semibold">
              Workshop <span className="mx-1 text-[#B4B0A5]">/</span>
              <span className="text-[#28543D]">Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-[#E8E3D8] bg-white px-3 py-2.5 md:flex">
              <Search size={16} className="text-[#898B80]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vehicle..."
                className="w-44 bg-transparent text-xs outline-none placeholder:text-[#A3A398]"
              />
            </div>
            <div className="border-l border-[#E8E3D8] pl-3">
              <AuthControls />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1700px] space-y-6 p-4 md:p-7">
          <section className="relative min-h-[270px] overflow-hidden rounded-[22px] bg-[#183D2D] md:min-h-[290px]">
            <img
              src="https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1800&q=90"
              alt="Premium motorcycle"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#10271D]/95 via-[#10271D]/75 to-[#10271D]/10" />
            <div className="relative z-10 flex min-h-[270px] max-w-[620px] flex-col justify-center p-7 md:min-h-[290px] md:p-12">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-bold tracking-[2px] text-[#F5A34D]">
                <span className="h-[2px] w-7 bg-[#E88B35]" />
                WORKSHOP OVERVIEW
                <span className="ml-2 rounded-full bg-white/10 px-2.5 py-1 text-[9px] tracking-[1px] text-white">
                  LIVE DATA
                </span>
              </div>
              <h1 className="max-w-[600px] text-3xl font-bold leading-tight tracking-tight text-white md:text-[42px]">
                Vehicle Inspection & Workshop Management
              </h1>
              <p className="mt-4 text-sm text-white/80 md:text-base">
                Inspect <span className="mx-1 text-[#E99A4B]">•</span>
                Repair <span className="mx-1 text-[#E99A4B]">•</span>
                Quality Check <span className="mx-1 text-[#E99A4B]">•</span>
                Sale Ready
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/vehicles"
                  className="flex items-center gap-2 rounded-xl bg-[#E88B35] px-5 py-3 text-sm font-bold text-[#1C2B20] transition hover:bg-[#F3A451]"
                >
                  <Plus size={18} /> Register Vehicle
                </Link>
                <Link
                  href="/inspections"
                  className="flex items-center gap-2 rounded-xl border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <ScanLine size={17} /> New Inspection
                </Link>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Dashboard data could not be fully loaded: {error}
              <button
                onClick={() => void loadDashboard()}
                className="ml-3 font-bold underline"
              >
                Retry
              </button>
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="group relative overflow-hidden rounded-2xl border border-[#E7E4D9] bg-white p-5 shadow-[0_3px_12px_rgba(40,50,35,0.025)] transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#72776D]">
                    {stat.label}
                  </span>
                  <div
                    className={`rounded-xl p-3 ${
                      stat.color === "green"
                        ? "bg-[#E5F2E5] text-[#25824B]"
                        : stat.color === "orange"
                        ? "bg-[#FFF0E0] text-[#D87825]"
                        : "bg-[#FFF3E4] text-[#C68A32]"
                    }`}
                  >
                    <stat.icon size={21} />
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <span className="text-[34px] font-bold tracking-tight text-[#26332A]">
                    {loading ? "—" : stat.value}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[#9A9B91]">
                  Records visible to your account
                </div>
                <div
                  className={`absolute bottom-0 left-0 h-[4px] w-1/3 rounded-r-full ${
                    stat.color === "green" ? "bg-[#398653]" : "bg-[#E88B35]"
                  }`}
                />
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-2xl border border-[#E8E4D9] bg-white p-5 md:p-6 xl:col-span-2">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity size={19} className="text-[#28543D]" />
                    <h2 className="text-base font-bold">Inspection Analytics</h2>
                  </div>
                  <p className="mt-1 text-xs text-[#96988D]">
                    Submitted inspections from your accessible records
                  </p>
                </div>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="rounded-xl border border-[#E8E4D9] bg-[#FCFBF7] px-3 py-2 text-xs outline-none"
                >
                  <option>This Week</option>
                  <option>This Month</option>
                  <option>This Year</option>
                </select>
              </div>
              <div className="h-[250px] w-full">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#96988D]">
                    Loading analytics...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="inspectionGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#45975D" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#45975D" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#F0EEE6" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#96988D", fontSize: 11 }} dy={10} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#96988D", fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E4D9", fontSize: 12 }} />
                      <Area type="monotone" dataKey="inspections" stroke="#32834C" strokeWidth={3} fill="url(#inspectionGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8E4D9] bg-white p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Activity size={19} className="text-[#28543D]" />
                <h2 className="text-base font-bold">Vehicle Pipeline</h2>
              </div>
              <p className="mt-1 text-xs text-[#96988D]">
                Latest inspection status per visible vehicle
              </p>
              <div className="mt-7 space-y-6">
                {pipelineItems.map((item) => {
                  const percent =
                    pipelineTotal > 0
                      ? Math.round((item.count / pipelineTotal) * 100)
                      : 0;
                  return (
                    <div key={item.label}>
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="text-[#777D73]">{item.label}</span>
                        <span className="font-bold">
                          {loading ? "—" : item.count}
                          <span className="ml-1 text-[#A3A398]">
                            {loading ? "" : `${percent}%`}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#F0EEE7]">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 flex items-center justify-between rounded-xl bg-[#F5F4ED] p-4">
                <span className="text-xs text-[#777D73]">
                  Vehicles in active pipeline
                </span>
                <span className="text-lg font-bold text-[#28543D]">
                  {loading ? "—" : pipelineTotal}
                </span>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-[#E8E4D9] bg-white xl:col-span-2">
              <div className="flex items-center justify-between border-b border-[#F0EEE7] p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Bike size={20} className="text-[#28543D]" />
                    <h2 className="text-base font-bold">Recent Vehicles</h2>
                  </div>
                  <p className="mt-1 text-xs text-[#96988D]">
                    Latest registered vehicles
                  </p>
                </div>
                <Link
                  href="/vehicles"
                  className="flex items-center gap-1 text-xs font-bold text-[#28543D] hover:text-[#D98232]"
                >
                  View All <ArrowRight size={15} />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead className="bg-[#F7F5EF] text-[10px] font-bold uppercase tracking-wider text-[#92958A]">
                    <tr>
                      <th className="px-5 py-4">Vehicle</th>
                      <th className="px-4 py-4">Registration</th>
                      <th className="px-4 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-sm text-[#96988D]">
                          Loading vehicles...
                        </td>
                      </tr>
                    ) : recentVehicles.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-sm text-[#96988D]">
                          No vehicles found.
                        </td>
                      </tr>
                    ) : (
                      recentVehicles.map((v) => {
                        const status = getVehicleStatus(
                          v.id,
                          inspections,
                          repairs,
                          ratings
                        );
                        return (
                          <tr
                            key={v.id}
                            className="border-t border-[#F1EFE9] transition hover:bg-[#FAF9F5]"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F0E7] text-[#28543D]">
                                  <Bike size={21} />
                                </div>
                                <div>
                                  <div className="text-xs font-bold">
                                    {v.make} {v.model}
                                  </div>
                                  <div className="mt-1 text-[10px] text-[#96988D]">
                                    {v.variant || v.vehicle_type || "Vehicle"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-[#7D8278]">
                              {v.registration_number}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-bold ${statusStyle[status.color] || statusStyle.blue}`}
                              >
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8E4D9] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity size={19} className="text-[#28543D]" />
                    <h2 className="text-base font-bold">Recent Inspections</h2>
                  </div>
                  <p className="mt-1 text-xs text-[#96988D]">
                    Latest inspection records
                  </p>
                </div>
                <ClipboardCheck size={19} className="text-[#92958A]" />
              </div>

              <div className="mt-7 space-y-7">
                {loading ? (
                  <p className="text-sm text-[#96988D]">Loading inspections...</p>
                ) : recentInspections.length === 0 ? (
                  <p className="text-sm text-[#96988D]">
                    No inspection records available.
                  </p>
                ) : (
                  recentInspections.map((inspection) => {
                    const vehicle = vehicles.find(
                      (v) => v.id === inspection.vehicle_id
                    );
                    const isDone = Boolean(
                      inspection.submitted_at || inspection.completed_at
                    );
                    return (
                      <div key={inspection.id} className="flex gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            isDone
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <AlertTriangle size={18} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold capitalize">
                            {inspection.status.replaceAll("_", " ")}
                          </div>
                          <div className="mt-1 truncate text-[10px] text-[#92958A]">
                            {vehicle
                              ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}`
                              : "Vehicle details not visible"}
                          </div>
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-[#A0A195]">
                            <Clock3 size={11} />
                            {timeAgo(inspection.submitted_at || inspection.started_at || inspection.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <Link
                href="/inspections"
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-[#E8E4D9] py-3 text-xs font-semibold text-[#526052] transition hover:bg-[#F7F5EF]"
              >
                View Inspections <ArrowRight size={14} />
              </Link>
            </div>
          </section>

          <footer className="flex flex-col justify-between gap-2 border-t border-[#E8E4D9] py-6 text-[10px] text-[#92958A] sm:flex-row">
            <span>© 2026 INSPECTION ENGINE. All rights reserved.</span>
            <span className="font-semibold tracking-[1.5px]">
              PRECISION · TRANSPARENCY · TRUST
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
