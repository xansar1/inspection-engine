
"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  CheckCircle2,
  ShieldCheck,
  Wrench,
  ClipboardCheck,
  Gauge,
  Clock,
  MapPin,
  Phone,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type ShowcaseVehicle = {
  id: string;
  make: string;
  model: string;
  variant: string;
  vehicleType: "motorcycle" | "scooter";
  registrationNumber: string;
  registrationYear: number;
  manufacturingYear: number;
  odometerKm: number;
  condition: "Excellent" | "Very Good" | "Good" | "Fair";
  rating: number;
  safetyClearance: "cleared" | "unresolved";
  criticalFailures: number;
  inspectionCompleted: boolean;
  saleReady: boolean;
  pendingCosmeticWorks: string[];
  image: string;
  fuelType: string;
  engineCapacity: string;
  colour: string;
  reportChecks: { area: string; result: string; note: string }[];
};

const demoVehicles: ShowcaseVehicle[] = [
  {
    id: "demo-activa-6g",
    make: "Honda",
    model: "Activa 6G",
    variant: "Deluxe",
    vehicleType: "scooter",
    registrationNumber: "KA 03 MN 4821",
    registrationYear: 2022,
    manufacturingYear: 2022,
    odometerKm: 18500,
    condition: "Very Good",
    rating: 4.5,
    safetyClearance: "cleared",
    criticalFailures: 0,
    inspectionCompleted: true,
    saleReady: true,
    pendingCosmeticWorks: ["Light scuff on right side panel"],
    image:
      "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=85",
    fuelType: "Petrol",
    engineCapacity: "109.51cc",
    colour: "Pearl Precious White",
    reportChecks: [
      { area: "Brakes & tyres", result: "Passed", note: "Illustrative demo check" },
      { area: "Steering & suspension", result: "Passed", note: "Illustrative demo check" },
      { area: "Lights & electrical", result: "Passed", note: "Illustrative demo check" },
      { area: "Engine & transmission", result: "Passed", note: "Illustrative demo check" },
    ],
  },
  {
    id: "demo-pulsar-ns200",
    make: "Bajaj",
    model: "Pulsar NS200",
    variant: "Dual Channel ABS",
    vehicleType: "motorcycle",
    registrationNumber: "MH 12 QX 6314",
    registrationYear: 2021,
    manufacturingYear: 2021,
    odometerKm: 26000,
    condition: "Good",
    rating: 4,
    safetyClearance: "cleared",
    criticalFailures: 0,
    inspectionCompleted: true,
    saleReady: true,
    pendingCosmeticWorks: ["Small tank paint touch-up"],
    image:
      "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1000&q=85",
    fuelType: "Petrol",
    engineCapacity: "199.5cc",
    colour: "Burnt Red",
    reportChecks: [
      { area: "Brakes & tyres", result: "Passed", note: "Illustrative demo check" },
      { area: "Steering & suspension", result: "Passed", note: "Illustrative demo check" },
      { area: "Lights & electrical", result: "Passed", note: "Illustrative demo check" },
      { area: "Engine & transmission", result: "Passed", note: "Illustrative demo check" },
    ],
  },
  {
    id: "demo-apache-rtr160",
    make: "TVS",
    model: "Apache RTR 160 4V",
    variant: "Special Edition",
    vehicleType: "motorcycle",
    registrationNumber: "TN 09 CF 2758",
    registrationYear: 2023,
    manufacturingYear: 2023,
    odometerKm: 11240,
    condition: "Excellent",
    rating: 4.8,
    safetyClearance: "cleared",
    criticalFailures: 0,
    inspectionCompleted: true,
    saleReady: true,
    pendingCosmeticWorks: [],
    image:
      "https://images.unsplash.com/photo-1558981285-6f0c94958bb6?auto=format&fit=crop&w=1000&q=85",
    fuelType: "Petrol",
    engineCapacity: "159.7cc",
    colour: "Matte Black",
    reportChecks: [
      { area: "Brakes & tyres", result: "Passed", note: "Illustrative demo check" },
      { area: "Steering & suspension", result: "Passed", note: "Illustrative demo check" },
      { area: "Lights & electrical", result: "Passed", note: "Illustrative demo check" },
      { area: "Engine & transmission", result: "Passed", note: "Illustrative demo check" },
    ],
  },
  {
    id: "demo-access-125",
    make: "Suzuki",
    model: "Access 125",
    variant: "Ride Connect Edition",
    vehicleType: "scooter",
    registrationNumber: "DL 8S BV 9042",
    registrationYear: 2024,
    manufacturingYear: 2024,
    odometerKm: 6840,
    condition: "Very Good",
    rating: 4.5,
    safetyClearance: "cleared",
    criticalFailures: 0,
    inspectionCompleted: true,
    saleReady: true,
    pendingCosmeticWorks: ["Minor mirror housing mark"],
    image:
      "https://images.unsplash.com/photo-1558981285-6f0c94958bb6?auto=format&fit=crop&w=1000&q=85",
    fuelType: "Petrol",
    engineCapacity: "124cc",
    colour: "Metallic Matte Black",
    reportChecks: [
      { area: "Brakes & tyres", result: "Passed", note: "Illustrative demo check" },
      { area: "Steering & suspension", result: "Passed", note: "Illustrative demo check" },
      { area: "Lights & electrical", result: "Passed", note: "Illustrative demo check" },
      { area: "Engine & transmission", result: "Passed", note: "Illustrative demo check" },
    ],
  },
];

const services = [
  {
    icon: ClipboardCheck,
    number: "01",
    title: "Vehicle Inspection",
    description:
      "Detailed multi-point inspection covering every important component of your motorcycle.",
  },
  {
    icon: Wrench,
    number: "02",
    title: "Professional Repairs",
    description:
      "Identify issues, track repairs and maintain a complete record of every service.",
  },
  {
    icon: ShieldCheck,
    number: "03",
    title: "Quality Assurance",
    description:
      "Every completed repair goes through a dedicated quality verification process.",
  },
  {
    icon: Gauge,
    number: "04",
    title: "Vehicle Health Report",
    description:
      "Get a clear picture of vehicle condition, inspection results and overall quality.",
  },
];

const features = [
  "Detailed vehicle inspection",
  "Photo and video evidence",
  "Transparent repair tracking",
  "Verified quality reports",
];

const vehicleFilters: {
  label: string;
  value: "all" | "motorcycle" | "scooter";
}[] = [
  { label: "All", value: "all" },
  { label: "Motorcycles", value: "motorcycle" },
  { label: "Scooters", value: "scooter" },
];

export default function Home() {
  const [vehicleType, setVehicleType] = useState<
    "all" | "motorcycle" | "scooter"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest-rated">(
    "newest"
  );
  const [selectedVehicle, setSelectedVehicle] =
    useState<ShowcaseVehicle | null>(null);

  const saleReadyVehicles = useMemo(
    () =>
      demoVehicles.filter(
        (vehicle) =>
          vehicle.safetyClearance === "cleared" &&
          vehicle.criticalFailures === 0 &&
          vehicle.inspectionCompleted &&
          vehicle.saleReady
      ),
    []
  );

  const visibleVehicles = useMemo(() => {
    const filtered = saleReadyVehicles.filter(
      (vehicle) => vehicleType === "all" || vehicle.vehicleType === vehicleType
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === "highest-rated") return b.rating - a.rating;
      const yearDifference = a.manufacturingYear - b.manufacturingYear;
      return sortBy === "newest" ? -yearDifference : yearDifference;
    });
  }, [saleReadyVehicles, sortBy, vehicleType]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#F7F5EF] text-[#26352A]">

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-[#E8E3D8] bg-[#F9F7F1]/95 backdrop-blur-lg">
        <div className="mx-auto flex h-[82px] max-w-[1450px] items-center justify-between px-5 md:px-10">

          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#244A36] text-[#EBA052]">
              <Bike size={26} />
            </div>
            <div>
              <h2 className="text-[15px] font-extrabold tracking-[1.5px]">
                INSPECTION ENGINE
              </h2>
              <p className="mt-1 text-[9px] font-semibold tracking-[3px] text-[#A27649]">
                TRUST IN EVERY DETAIL
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-9 text-[13px] font-semibold text-[#697267] md:flex">
            <a href="#home" className="text-[#244A36]">Home</a>
            <a href="#about" className="transition hover:text-[#C77A35]">About Us</a>
            <a href="#services" className="transition hover:text-[#C77A35]">Our Services</a>
            <a href="#process" className="transition hover:text-[#C77A35]">Our Process</a>
            <a href="#contact" className="transition hover:text-[#C77A35]">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="/login"
              className="flex items-center gap-2 rounded-xl bg-[#244A36] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#345D45] sm:px-5"
            >
              Staff Sign In <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="home" className="relative min-h-[620px] overflow-hidden bg-[#1C3024] md:min-h-[690px]">

        <img
          src="https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=2000&q=90"
          alt="Motorcycle in a premium workshop setting"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#14291D]/95 via-[#14291D]/75 to-[#14291D]/10" />

        <div className="relative mx-auto flex min-h-[620px] max-w-[1450px] items-center px-6 py-20 md:min-h-[690px] md:px-12">

          <div className="max-w-[680px]">

            <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/10 px-4 py-2 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-[#E99B4C]" />
              <span className="text-[10px] font-bold tracking-[2px] text-white">
                PROFESSIONAL TWO-WHEELER CARE
              </span>
            </div>

            <h1 className="text-[43px] font-bold leading-[1.12] tracking-tight text-white sm:text-6xl md:text-[72px]">
              Every Ride
              <br />
              Deserves
              <br />
              <span className="font-serif italic text-[#E8A15D]">
                Confidence.
              </span>
            </h1>

            <p className="mt-7 max-w-[500px] text-sm leading-7 text-white/75 md:text-base">
              Experience a smarter approach to motorcycle inspection,
              professional repairs and quality assurance. Every detail
              matters when it comes to your vehicle.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="/login"
                className="flex items-center gap-3 rounded-xl bg-[#E99B4C] px-7 py-4 text-sm font-bold text-[#233529] transition hover:bg-[#F3B16E]"
              >
                Staff Workspace <ArrowRight size={17} />
              </a>

              <a
                href="#services"
                className="flex items-center gap-3 rounded-xl border border-white/50 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Our Services
              </a>
            </div>

            <div className="mt-14 flex flex-wrap gap-8 border-t border-white/20 pt-7">
              <div>
                <div className="text-2xl font-bold text-white">260+</div>
                <div className="mt-1 text-[10px] tracking-wide text-white/60">INSPECTION CHECKPOINTS</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">360°</div>
                <div className="mt-1 text-[10px] tracking-wide text-white/60">VEHICLE ASSESSMENT</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">100%</div>
                <div className="mt-1 text-[10px] tracking-wide text-white/60">FOCUS ON TRANSPARENCY</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SALE-READY VEHICLES */}
      <section id="sale-ready" className="bg-white px-5 py-20 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1300px]">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-[680px]">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <p className="text-[11px] font-bold tracking-[3px] text-[#B8783D]">
                  INSPECTED WITH CARE
                </p>
                <span className="rounded-full bg-[#FFF0DD] px-3 py-1 text-[10px] font-extrabold tracking-[1.5px] text-[#A95719]">
                  DEMO MODE
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-[#244A36] sm:text-4xl md:text-5xl">
                Available Vehicles
                <span className="mt-1 block font-serif italic text-[#B8783D]">
                  Sale Ready
                </span>
              </h2>
              <p className="mt-5 max-w-[620px] text-sm leading-7 text-[#777D71]">
                Explore illustrative two-wheeler listings with sample inspection
                summaries. Every listing shown here is demo content, not a live
                vehicle or inspection record.
              </p>
            </div>

            <Link
              href="/vehicles"
              className="inline-flex w-fit items-center gap-2 text-sm font-bold text-[#244A36] transition hover:text-[#C77A35]"
            >
              View All Vehicles <ArrowRight size={17} />
            </Link>
          </div>

          <div className="mt-9 flex flex-col gap-4 border-y border-[#E8E3D8] py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2" aria-label="Filter by vehicle type">
              {vehicleFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setVehicleType(filter.value)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                    vehicleType === filter.value
                      ? "bg-[#244A36] text-white"
                      : "border border-[#E8E3D8] bg-[#FAF9F5] text-[#697267] hover:border-[#9DAE9E] hover:text-[#244A36]"
                  }`}
                  aria-pressed={vehicleType === filter.value}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 text-xs font-semibold text-[#697267]">
              Sort by
              <select
                value={sortBy}
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    value === "newest" ||
                    value === "oldest" ||
                    value === "highest-rated"
                  ) {
                    setSortBy(value);
                  }
                }}
                className="rounded-lg border border-[#E8E3D8] bg-[#FAF9F5] px-3 py-2.5 text-xs font-semibold text-[#344337] outline-none focus:border-[#63866B]"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="highest-rated">Highest rated</option>
              </select>
            </label>
          </div>

          <div className="mt-7 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {visibleVehicles.map((vehicle) => {
              const age = Math.max(
                0,
                new Date().getFullYear() - vehicle.manufacturingYear
              );

              return (
                <article
                  key={vehicle.id}
                  className="group overflow-hidden rounded-2xl border border-[#E8E3D8] bg-[#FAF9F5] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-56 overflow-hidden bg-[#E8E3D8]">
                    <Image
                      src={vehicle.image}
                      alt={`${vehicle.make} ${vehicle.model} ${vehicle.variant}`}
                      width={1000}
                      height={600}
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      unoptimized
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#244A36]/95 px-3 py-1.5 text-[10px] font-bold tracking-wide text-white">
                      <CheckCircle2 size={13} /> SALE READY
                    </span>
                    <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#A95719]">
                      DEMO LISTING
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#A27649]">
                          {vehicle.make}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-[#244A36]">
                          {vehicle.model}
                        </h3>
                        <p className="mt-1 text-xs text-[#85877C]">
                          {vehicle.variant}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold tracking-wide text-[#99998D]">
                          {vehicle.registrationNumber}
                        </p>
                      </div>
                      <span className="rounded-lg bg-[#EAF1E7] px-2.5 py-1.5 text-[10px] font-bold capitalize text-[#315D40]">
                        {vehicle.vehicleType}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-[#E8E3D8] py-3 text-[11px] text-[#697267]">
                      <span>
                        Reg. {vehicle.registrationYear} · Mfg.{" "}
                        {vehicle.manufacturingYear}
                      </span>
                      <span>
                        {age} {age === 1 ? "year" : "years"} old
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[#475448]">
                        {vehicle.odometerKm.toLocaleString("en-IN")} km
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                          vehicle.condition === "Excellent"
                            ? "bg-[#EAF1E7] text-[#315D40]"
                            : vehicle.condition === "Very Good"
                              ? "bg-[#E8F0E7] text-[#47714B]"
                              : vehicle.condition === "Good"
                                ? "bg-[#F3EEDC] text-[#8A6A20]"
                                : "bg-[#F8EBDD] text-[#A95719]"
                        }`}
                      >
                        {vehicle.condition}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <RatingStars rating={vehicle.rating} />
                        <span className="text-xs font-bold text-[#344337]">
                          {vehicle.rating.toFixed(1)}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#315D40]">
                        <ShieldCheck size={14} /> Safety cleared
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl bg-[#F0F1E9] p-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#475448]">
                          Critical safety issues
                        </span>
                        <span className="font-bold text-[#315D40]">
                          {vehicle.criticalFailures}
                        </span>
                      </div>
                      <div className="mt-2 border-t border-[#DFE2D6] pt-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#777D71]">
                          Pending cosmetic works
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-[#697267]">
                          {vehicle.pendingCosmeticWorks.length
                            ? vehicle.pendingCosmeticWorks.join(", ")
                            : "None"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedVehicle(vehicle)}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E99B4C] px-4 py-3 text-xs font-bold text-[#233529] transition hover:bg-[#F3B16E]"
                    >
                      View Inspection Report <ArrowUpRight size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* INTRODUCTION */}
      <section id="about" className="mx-auto max-w-[1300px] px-6 py-24 md:px-12 md:py-32">

        <div className="grid items-center gap-14 lg:grid-cols-2">

          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1000&q=85"
              alt="Motorcycle close-up"
              className="h-[420px] w-full rounded-[25px] object-cover"
            />

            <div className="absolute -bottom-7 -right-3 rounded-2xl bg-[#244A36] p-6 text-white shadow-xl md:-right-7">
              <ShieldCheck size={30} className="mb-3 text-[#E9A15D]" />
              <div className="text-lg font-bold">Quality First</div>
              <div className="mt-1 text-xs text-white/65">Every detail matters.</div>
            </div>
          </div>

          <div className="lg:pl-5">
            <p className="mb-4 text-[11px] font-bold tracking-[3px] text-[#B8783D]">
              ABOUT INSPECTION ENGINE
            </p>

            <h2 className="text-4xl font-bold leading-tight tracking-tight text-[#244A36] md:text-5xl">
              More Than Just
              <br />
              Vehicle Inspection.
            </h2>

            <p className="mt-7 text-sm leading-8 text-[#777D71]">
              INSPECTION ENGINE brings vehicle inspection, repair
              management and quality verification together in one
              organised system.
            </p>

            <p className="mt-4 text-sm leading-8 text-[#777D71]">
              From the first inspection to the final quality check,
              every stage is documented to provide clarity,
              accountability and confidence in every vehicle.
            </p>

            <div className="mt-8 space-y-4">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <CheckCircle2 size={19} className="shrink-0 text-[#47845A]" />
                  <span className="text-sm font-semibold text-[#475448]">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <a href="/dashboard" className="mt-9 inline-flex items-center gap-3 text-sm font-bold text-[#244A36] hover:text-[#C77A35]">
              Discover our platform <ArrowRight size={17} />
            </a>
          </div>

        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="bg-[#EEEDE4] px-6 py-24 md:px-12 md:py-28">

        <div className="mx-auto max-w-[1300px]">

          <div className="mx-auto mb-14 max-w-[650px] text-center">
            <p className="mb-4 text-[11px] font-bold tracking-[3px] text-[#B8783D]">
              WHAT WE DO
            </p>

            <h2 className="text-4xl font-bold tracking-tight text-[#244A36] md:text-5xl">
              Complete Care.
              <br />
              Complete Confidence.
            </h2>

            <p className="mt-5 text-sm leading-7 text-[#85877C]">
              A structured approach to every stage of vehicle
              inspection and workshop management.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <div
                key={service.number}
                className="group rounded-2xl border border-[#E5E1D5] bg-[#FAF9F5] p-7 transition duration-300 hover:-translate-y-2 hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6EEE5] text-[#315D40] transition group-hover:bg-[#244A36] group-hover:text-white">
                    <service.icon size={26} />
                  </div>
                  <span className="text-sm font-bold text-[#C5BBA9]">
                    {service.number}
                  </span>
                </div>

                <h3 className="mt-7 text-lg font-bold text-[#294532]">
                  {service.title}
                </h3>

                <p className="mt-4 text-xs leading-7 text-[#85877C]">
                  {service.description}
                </p>

                <div className="mt-7 h-[2px] w-10 bg-[#D68B45] transition-all group-hover:w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" className="mx-auto max-w-[1300px] px-6 py-24 md:px-12 md:py-28">

        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">

          <div>
            <p className="mb-4 text-[11px] font-bold tracking-[3px] text-[#B8783D]">
              HOW IT WORKS
            </p>

            <h2 className="text-4xl font-bold leading-tight text-[#244A36] md:text-5xl">
              A Clear Process.
              <br />
              A Better Experience.
            </h2>

            <p className="mt-5 max-w-[480px] text-sm leading-8 text-[#85877C]">
              Every vehicle follows a structured journey to ensure
              inspection accuracy, repair transparency and final
              quality verification.
            </p>

            <div className="mt-10 space-y-7">
              {[
                ["01", "Vehicle Registration", "Record vehicle information and identification details."],
                ["02", "Detailed Inspection", "Inspect vehicle components and document findings."],
                ["03", "Repair & Maintenance", "Track required repairs and mechanic progress."],
                ["04", "Final Quality Check", "Verify completed work and prepare the final report."],
              ].map((step) => (
                <div key={step[0]} className="flex gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#244A36] text-sm font-bold text-white">
                    {step[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#294532]">{step[1]}</h3>
                    <p className="mt-2 text-xs leading-6 text-[#85877C]">{step[2]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1000&q=85"
              alt="Motorcycle detail"
              className="h-[550px] w-full rounded-[25px] object-cover"
            />

            <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/30 bg-[#183D2D]/90 p-6 text-white backdrop-blur-md">
              <p className="text-[10px] font-bold tracking-[2px] text-[#EBA052]">
                OUR COMMITMENT
              </p>
              <h3 className="mt-3 text-2xl font-bold">
                Every Detail.
                <br />
                Properly Verified.
              </h3>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 md:px-12">
        <div className="relative mx-auto max-w-[1300px] overflow-hidden rounded-[25px] bg-[#183D2D] px-7 py-16 text-center md:px-16 md:py-20">

          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full border border-white/10" />

          <div className="relative z-10">
            <p className="text-[11px] font-bold tracking-[3px] text-[#EBA052]">
              INSPECTION ENGINE
            </p>

            <h2 className="mt-5 text-3xl font-bold text-white md:text-5xl">
              Experience Better Vehicle Care.
            </h2>

            <p className="mx-auto mt-5 max-w-[570px] text-sm leading-7 text-white/65">
              Explore our inspection and workshop management
              platform and discover a more transparent way
              to manage every vehicle.
            </p>

            <a
              href="/dashboard"
              className="mt-9 inline-flex items-center gap-3 rounded-xl bg-[#E99B4C] px-8 py-4 text-sm font-bold text-[#26352A] transition hover:bg-[#F3B16E]"
            >
              Explore Dashboard <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="border-t border-[#E8E3D8] bg-[#EEEDE4] px-6 py-16 md:px-12">

        <div className="mx-auto grid max-w-[1300px] gap-10 md:grid-cols-3">

          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#244A36] text-[#EBA052]">
                <Bike size={25} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold tracking-[1px]">INSPECTION ENGINE</h3>
                <p className="text-[9px] tracking-[3px] text-[#B8783D]">TRUST IN EVERY DETAIL</p>
              </div>
            </div>

            <p className="mt-5 max-w-[300px] text-xs leading-7 text-[#85877C]">
              A smarter approach to two-wheeler inspection,
              repair management and quality assurance.
            </p>
          </div>

          <div>
            <h3 className="mb-5 text-sm font-bold text-[#244A36]">Quick Links</h3>
            <div className="space-y-3 text-xs text-[#777D71]">
              <a href="#about" className="block hover:text-[#C77A35]">About Us</a>
              <a href="#services" className="block hover:text-[#C77A35]">Our Services</a>
              <a href="#process" className="block hover:text-[#C77A35]">Our Process</a>
              <a href="/dashboard" className="block hover:text-[#C77A35]">Dashboard</a>
            </div>
          </div>

          <div>
            <h3 className="mb-5 text-sm font-bold text-[#244A36]">Get In Touch</h3>
            <div className="space-y-4 text-xs text-[#777D71]">
              <div className="flex items-center gap-3">
                <MapPin size={17} className="text-[#B8783D}" />
                Workshop Address
              </div>
              <div className="flex items-center gap-3">
                <Phone size={17} className="text-[#B8783D}" />
                Contact Number
              </div>
              <div className="flex items-center gap-3">
                <Clock size={17} className="text-[#B8783D]" />
                Working Hours
              </div>
            </div>
            <p className="mt-4 text-[10px] text-[#A09F92]">
              Replace these placeholders with actual workshop details.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-[1300px] flex-col justify-between gap-3 border-t border-[#DCD9CD] pt-6 text-[10px] text-[#929488] sm:flex-row">
          <span>© 2026 INSPECTION ENGINE. All rights reserved.</span>
          <span className="font-semibold tracking-[1.5px]">PRECISION · TRANSPARENCY · TRUST</span>
        </div>
      </section>

      {selectedVehicle && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#10271C]/70 p-3 backdrop-blur-sm"
          onClick={() => setSelectedVehicle(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspection-report-title"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#FAF9F5] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8E3D8] bg-[#FAF9F5] px-5 py-4">
              <div>
                <p className="text-[10px] font-extrabold tracking-[2px] text-[#A95719]">
                  ILLUSTRATIVE DEMO REPORT
                </p>
                <h2
                  id="inspection-report-title"
                  className="mt-1 text-lg font-bold text-[#244A36]"
                >
                  Full Inspection Report
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVehicle(null)}
                className="rounded-lg p-2 text-[#697267] transition hover:bg-[#EEEDE4]"
                aria-label="Close inspection report"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              <div className="grid gap-5 sm:grid-cols-[190px_1fr]">
                <Image
                  src={selectedVehicle.image}
                  alt={`${selectedVehicle.make} ${selectedVehicle.model}`}
                  width={800}
                  height={600}
                  unoptimized
                  className="h-40 w-full rounded-xl object-cover sm:h-full"
                />
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#A27649]">
                        {selectedVehicle.make} · {selectedVehicle.variant}
                      </p>
                      <h3 className="mt-1 text-2xl font-bold text-[#244A36]">
                        {selectedVehicle.model}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-[#697267]">
                        {selectedVehicle.registrationNumber}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#EAF1E7] px-3 py-1.5 text-[10px] font-bold text-[#315D40]">
                      SALE READY · DEMO
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <ReportFact label="Registration year" value={selectedVehicle.registrationYear} />
                    <ReportFact label="Manufacturing year" value={selectedVehicle.manufacturingYear} />
                    <ReportFact
                      label="Vehicle age"
                      value={`${Math.max(0, new Date().getFullYear() - selectedVehicle.manufacturingYear)} years`}
                    />
                    <ReportFact label="Odometer" value={`${selectedVehicle.odometerKm.toLocaleString("en-IN")} km`} />
                    <ReportFact label="Fuel" value={selectedVehicle.fuelType} />
                    <ReportFact label="Engine" value={selectedVehicle.engineCapacity} />
                    <ReportFact label="Colour" value={selectedVehicle.colour} />
                    <ReportFact label="Condition" value={selectedVehicle.condition} />
                    <ReportFact label="Rating" value={`${selectedVehicle.rating.toFixed(1)} / 5`} />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#DDE8DC] bg-[#EDF3EB] p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#315D40]">
                    <ShieldCheck size={18} /> Safety clearance: Cleared
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#526455]">
                    {selectedVehicle.criticalFailures} critical safety issues ·
                    inspection completed · sale-ready eligibility met.
                  </p>
                </div>
                <div className="rounded-xl border border-[#E8E3D8] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#A27649]">
                    Pending cosmetic works
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#697267]">
                    {selectedVehicle.pendingCosmeticWorks.length
                      ? selectedVehicle.pendingCosmeticWorks.join(", ")
                      : "None"}
                  </p>
                  <p className="mt-1 text-[10px] text-[#929488]">
                    Cosmetic items are listed separately from safety issues.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="mb-3 text-sm font-bold text-[#244A36]">
                  Inspection checklist
                </h3>
                <div className="overflow-hidden rounded-xl border border-[#E8E3D8] bg-white">
                  {selectedVehicle.reportChecks.map((check) => (
                    <div
                      key={check.area}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EEE7] px-4 py-3 last:border-b-0"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[#344337]">
                          {check.area}
                        </p>
                        <p className="mt-1 text-[10px] text-[#929488]">
                          {check.note}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#EAF1E7] px-2.5 py-1 text-[10px] font-bold text-[#315D40]">
                        {check.result}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-5 text-[#929488]">
                  Demo content only — this report is illustrative and does not
                  describe an actual vehicle inspection.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[#E99B4C]"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index));
        return (
          <span key={index} className="relative inline-flex">
            <Star size={15} className="text-[#DAD5C8]" />
            <span
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star size={15} className="fill-current text-[#E99B4C]" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function ReportFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-[#F0F1E9] p-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wide text-[#929488]">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#344337]">{value}</p>
    </div>
  );
}
