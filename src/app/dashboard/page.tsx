
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Bike, ClipboardCheck, Wrench, ShieldCheck,
  FileText, Users, Settings, Search, Bell, ChevronDown,
  ArrowUpRight, ArrowRight, Clock3, CheckCircle2,
  AlertTriangle, Plus, MoreHorizontal, Activity, Menu,
  Gauge, X, ScanLine, Home
} from "lucide-react";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid
} from "recharts";

const stats = [
  { label: "Total Vehicles", value: "128", change: "+12.8%", icon: Bike, color: "green" },
  { label: "Inspections Done", value: "96", change: "+8.4%", icon: ClipboardCheck, color: "orange" },
  { label: "Under Repair", value: "18", change: "+3.2%", icon: Wrench, color: "amber" },
  { label: "Ready for Sale", value: "06", change: "+14.5%", icon: ShieldCheck, color: "green" },
];

const chartData = [
  { day: "Mon", inspections: 42 },
  { day: "Tue", inspections: 72 },
  { day: "Wed", inspections: 53 },
  { day: "Thu", inspections: 90 },
  { day: "Fri", inspections: 67 },
  { day: "Sat", inspections: 100 },
  { day: "Sun", inspections: 80 },
];

const vehicles = [
  { id: "IE-1024", name: "Honda Activa 6G", reg: "KL 52 AB 1234", status: "Ready for Sale", rating: "4.8", image: "🛵", color: "green" },
  { id: "IE-1023", name: "Royal Enfield Classic", reg: "KL 08 CD 5678", status: "Under Repair", rating: "3.6", image: "🏍️", color: "orange" },
  { id: "IE-1022", name: "TVS Jupiter", reg: "KL 10 EF 9012", status: "Inspection", rating: "—", image: "🛵", color: "blue" },
  { id: "IE-1021", name: "Yamaha R15 V4", reg: "KL 11 GH 3456", status: "QC Pending", rating: "4.2", image: "🏍️", color: "purple" },
];

const activities = [
  { title: "Inspection completed", detail: "Honda Activa 6G · IE-1024", time: "10 min ago", icon: CheckCircle2, color: "green" },
  { title: "Repair started", detail: "Royal Enfield Classic · IE-1023", time: "35 min ago", icon: Wrench, color: "orange" },
  { title: "Quality check pending", detail: "Yamaha R15 V4 · IE-1021", time: "1 hour ago", icon: AlertTriangle, color: "amber" },
];

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

export default function Dashboard() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [period, setPeriod] = useState("This Week");
  const [search, setSearch] = useState("");

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#26332A]">

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[255px] flex-col bg-[#183D2D] text-white transition-transform duration-300 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>

        <div className="flex h-[94px] items-center justify-between border-b border-white/10 px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E88B35] text-[#183D2D]">
              <Gauge size={26} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[15px] font-extrabold tracking-[1px]">INSPECTION</div>
              <div className="text-[11px] font-bold tracking-[5px] text-[#E99A4B]">ENGINE</div>
              <div className="mt-1 text-[9px] text-white/50">Vehicle Inspection & Workshop</div>
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
                      {active && <span className="ml-auto h-2 w-2 rounded-full bg-[#D98232]" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* SIDEBAR PROMO */}
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
            <Link href="/inspections" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#E88B35] py-2.5 text-xs font-bold text-[#17291E] hover:bg-[#F3A451]">
              New Inspection <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      {menuOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* MAIN CONTENT */}
      <main className="min-h-screen lg:ml-[255px]">

        {/* TOP NAVIGATION */}
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#E9E4D9] bg-[#FDFCF8]/95 px-4 backdrop-blur-xl md:px-8">

          <div className="flex items-center gap-4">
            <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 hover:bg-[#EEEAE0] lg:hidden">
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
                placeholder="Search vehicle, inspection..."
                className="w-44 bg-transparent text-xs outline-none placeholder:text-[#A3A398]"
              />
            </div>

            <button className="relative rounded-xl border border-[#E8E3D8] bg-white p-2.5 text-[#526052] hover:bg-[#F2EFE6]">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E88B35]" />
            </button>

            <div className="flex items-center gap-2 border-l border-[#E8E3D8] pl-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#183D2D] text-sm font-bold text-white">A</div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold">Administrator</div>
                <div className="text-[10px] text-[#92948A]">Super Admin</div>
              </div>
              <ChevronDown size={15} className="text-[#92948A]" />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1700px] space-y-6 p-4 md:p-7">

          {/* HERO */}
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
                <span className="ml-2 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-extrabold tracking-[1.5px] text-white">
                  DEMO MODE
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
                <Link href="/vehicles" className="flex items-center gap-2 rounded-xl bg-[#E88B35] px-5 py-3 text-sm font-bold text-[#1C2B20] transition hover:bg-[#F3A451]">
                  <Plus size={18} /> Register Vehicle
                </Link>
                <Link href="/inspections" className="flex items-center gap-2 rounded-xl border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  <ScanLine size={17} /> New Inspection
                </Link>
              </div>
            </div>
          </section>

          {/* STAT CARDS */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-[#E7E4D9] bg-white p-5 shadow-[0_3px_12px_rgba(40,50,35,0.025)] transition hover:-translate-y-1 hover:shadow-lg">

                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#72776D]">{stat.label}</span>
                  <div className={`rounded-xl p-3 ${stat.color === "green" ? "bg-[#E5F2E5] text-[#25824B]" : stat.color === "orange" ? "bg-[#FFF0E0] text-[#D87825]" : "bg-[#FFF3E4] text-[#C68A32]"}`}>
                    <stat.icon size={21} />
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <span className="text-[34px] font-bold tracking-tight text-[#26332A]">{stat.value}</span>
                  <span className="mb-2 flex items-center gap-1 rounded-full bg-[#E7F4E6] px-2.5 py-1 text-[11px] font-bold text-[#26804B]">
                    <ArrowUpRight size={13} /> {stat.change}
                  </span>
                </div>

                <div className="mt-1 text-[11px] text-[#9A9B91]">Compared to last month</div>

                <div className={`absolute bottom-0 left-0 h-[4px] w-1/3 rounded-r-full ${stat.color === "green" ? "bg-[#398653]" : "bg-[#E88B35]"}`} />
              </div>
            ))}
          </section>

          {/* ANALYTICS */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">

            {/* CHART */}
            <div className="rounded-2xl border border-[#E8E4D9] bg-white p-5 md:p-6 xl:col-span-2">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity size={19} className="text-[#28543D]" />
                    <h2 className="text-base font-bold">Inspection Analytics</h2>
                  </div>
                  <p className="mt-1 text-xs text-[#96988D]">Vehicle inspection activity throughout the week</p>
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
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="inspectionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#45975D" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#45975D" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#F0EEE6" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#96988D", fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#96988D", fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E4D9", fontSize: 12 }} />
                    <Area type="monotone" dataKey="inspections" stroke="#32834C" strokeWidth={3} fill="url(#inspectionGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* VEHICLE PIPELINE */}
            <div className="rounded-2xl border border-[#E8E4D9] bg-white p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Activity size={19} className="text-[#28543D]" />
                <h2 className="text-base font-bold">Vehicle Pipeline</h2>
              </div>
              <p className="mt-1 text-xs text-[#96988D]">Current workshop distribution</p>

              <div className="mt-7 space-y-6">
                {[
                  { label: "Inspection", count: 12, percent: "22%", width: "22%", color: "bg-blue-500" },
                  { label: "Under Repair", count: 18, percent: "34%", width: "34%", color: "bg-[#E88B35]" },
                  { label: "Quality Control", count: 8, percent: "15%", width: "15%", color: "bg-purple-500" },
                  { label: "Ready for Sale", count: 15, percent: "29%", width: "29%", color: "bg-green-500" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-[#777D73]">{item.label}</span>
                      <span className="font-bold">{item.count} <span className="ml-1 text-[#A3A398]">{item.percent}</span></span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#F0EEE7]">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: item.width }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between rounded-xl bg-[#F5F4ED] p-4">
                <span className="text-xs text-[#777D73]">Total active vehicles</span>
                <span className="text-lg font-bold text-[#28543D]">53</span>
              </div>
            </div>
          </section>

          {/* RECENT VEHICLES + ACTIVITIES */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">

            <div className="overflow-hidden rounded-2xl border border-[#E8E4D9] bg-white xl:col-span-2">

              <div className="flex items-center justify-between border-b border-[#F0EEE7] p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Bike size={20} className="text-[#28543D]" />
                    <h2 className="text-base font-bold">Recent Vehicles</h2>
                  </div>
                  <p className="mt-1 text-xs text-[#96988D]">Latest vehicle activity in your workshop</p>
                </div>
                <Link href="/vehicles" className="flex items-center gap-1 text-xs font-bold text-[#28543D] hover:text-[#D98232]">
                  View All <ArrowRight size={15} />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead className="bg-[#F7F5EF] text-[10px] font-bold uppercase tracking-wider text-[#92958A]">
                    <tr>
                      <th className="px-5 py-4">Vehicle</th>
                      <th className="px-4 py-4">Reference</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Rating</th>
                      <th className="px-4 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles
                      .filter((v) => `${v.name} ${v.reg} ${v.id}`.toLowerCase().includes(search.toLowerCase()))
                      .map((v) => (
                      <tr key={v.id} className="border-t border-[#F1EFE9] transition hover:bg-[#FAF9F5]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F0E7] text-xl">{v.image}</div>
                            <div>
                              <div className="text-xs font-bold">{v.name}</div>
                              <div className="mt-1 text-[10px] text-[#96988D]">{v.reg}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-[#7D8278]">{v.id}</td>
                        <td className="px-4 py-4">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-bold ${statusStyle[v.color]}`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs font-bold">
                          {v.rating === "—" ? "—" : <span className="text-[#C98B2F]">★ {v.rating}</span>}
                        </td>
                        <td className="px-4 py-4 text-[#999B91]">
                          <button aria-label={`More options for ${v.name}`}><MoreHorizontal size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ACTIVITY */}
            <div className="rounded-2xl border border-[#E8E4D9] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity size={19} className="text-[#28543D]" />
                    <h2 className="text-base font-bold">Recent Activity</h2>
                  </div>
                  <p className="mt-1 text-xs text-[#96988D]">Latest workshop activities</p>
                </div>
                <MoreHorizontal size={19} className="text-[#92958A]" />
              </div>

              <div className="mt-7 space-y-7">
                {activities.map((activity, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${activity.color === "green" ? "bg-green-100 text-green-700" : activity.color === "orange" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>
                      <activity.icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold">{activity.title}</div>
                      <div className="mt-1 truncate text-[10px] text-[#92958A]">{activity.detail}</div>
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-[#A0A195]">
                        <Clock3 size={11} /> {activity.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/reports" className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-[#E8E4D9] py-3 text-xs font-semibold text-[#526052] transition hover:bg-[#F7F5EF]">
                View Activity History <ArrowRight size={14} />
              </Link>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="flex flex-col justify-between gap-2 border-t border-[#E8E4D9] py-6 text-[10px] text-[#92958A] sm:flex-row">
            <span>© 2026 INSPECTION ENGINE. All rights reserved.</span>
            <span className="font-semibold tracking-[1.5px]">PRECISION · TRANSPARENCY · TRUST</span>
          </footer>

        </div>
      </main>
    </div>
  );
}
