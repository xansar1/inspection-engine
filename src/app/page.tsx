
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
  Menu,
  Instagram,
} from "lucide-react";

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

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F7F5EF] text-[#26352A]">

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-[#E8E3D8] bg-[#F9F7F1]/95 backdrop-blur-lg">
        <div className="mx-auto flex h-[82px] max-w-[1450px] items-center justify-between px-5 md:px-10">

          <a href="/" className="flex items-center gap-3">
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
          </a>

          <nav className="hidden items-center gap-9 text-[13px] font-semibold text-[#697267] md:flex">
            <a href="#home" className="text-[#244A36]">Home</a>
            <a href="#about" className="transition hover:text-[#C77A35]">About Us</a>
            <a href="#services" className="transition hover:text-[#C77A35]">Our Services</a>
            <a href="#process" className="transition hover:text-[#C77A35]">Our Process</a>
            <a href="#contact" className="transition hover:text-[#C77A35]">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl bg-[#244A36] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#345D45] sm:px-5"
            >
              Dashboard <ArrowUpRight size={15} />
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
                href="/dashboard"
                className="flex items-center gap-3 rounded-xl bg-[#E99B4C] px-7 py-4 text-sm font-bold text-[#233529] transition hover:bg-[#F3B16E]"
              >
                Explore Dashboard <ArrowRight size={17} />
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

    </main>
  );
}
