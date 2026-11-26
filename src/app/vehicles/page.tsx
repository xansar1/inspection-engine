
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Search,
  Plus,
  X,
  Filter,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Gauge,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getInspectionActor } from "@/lib/supabase/staff";
import AuthControls from "@/app/_components/AuthControls";
import {
  getLatestTestModeResultForVehicle,
  type TestModeCheckpointResult,
  type TestModeResult,
} from "@/app/inspections/test-mode-results";

type Vehicle = {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  variant: string | null;
  vehicle_type: "motorcycle" | "scooter";
  fuel_type: string | null;
  engine_capacity: string | null;
  manufacturing_year: number | null;
  registration_year: number | null;
  colour: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  odometer_reading_km: number | null;
  owner_count: number | null;
  created_at: string;
};

const initialForm = {
  registration_number: "",
  make: "",
  model: "",
  variant: "",
  vehicle_type: "motorcycle" as "motorcycle" | "scooter",
  fuel_type: "Petrol",
  engine_capacity: "",
  manufacturing_year: "",
  registration_year: "",
  colour: "",
  chassis_number: "",
  engine_number: "",
  odometer_reading_km: "",
  owner_count: "1",
};

export default function VehiclesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [canRegister, setCanRegister] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actorId, setActorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [testResultState, setTestResultState] = useState<{
    vehicleId: string;
    status: "idle" | "loading" | "ready" | "error";
    result: TestModeResult | null;
    error: string;
  }>({
    vehicleId: "",
    status: "idle",
    result: null,
    error: "",
  });
  const [expandedTestResultId, setExpandedTestResultId] = useState("");

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const actor = await getInspectionActor(supabase);
      if (!actor) {
        setAuthorized(false);
        setCanRegister(false);
        setIsAdmin(false);
        setActorId("");
        setVehicles([]);
        return;
      }

      setAuthorized(true);
      setCanRegister(true);
      setIsAdmin(actor.profile.role === "admin");
      setActorId(actor.profile.id);
      const { data, error: fetchError } = await supabase
        .from("vehicles")
        .select(
          "id, registration_number, make, model, variant, vehicle_type, fuel_type, engine_capacity, manufacturing_year, registration_year, colour, chassis_number, engine_number, odometer_reading_km, owner_count, created_at"
        )
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(`Vehicles could not be loaded: ${fetchError.message}`);
      }
      setVehicles(data ?? []);
    } catch (loadError: unknown) {
      setAuthorized(false);
      setCanRegister(false);
      setIsAdmin(false);
      setActorId("");
      setVehicles([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Vehicles could not be loaded from Supabase."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const selectedVehicleId = selectedVehicle?.id ?? "";
  useEffect(() => {
    if (!selectedVehicleId || !isAdmin) {
      setTestResultState({
        vehicleId: selectedVehicleId,
        status: "idle",
        result: null,
        error: "",
      });
      setExpandedTestResultId("");
      return;
    }

    setTestResultState({
      vehicleId: selectedVehicleId,
      status: "loading",
      result: null,
      error: "",
    });
    setExpandedTestResultId("");
    try {
      const result =
        getLatestTestModeResultForVehicle(selectedVehicleId);
      setTestResultState({
        vehicleId: selectedVehicleId,
        status: "ready",
        result,
        error: "",
      });
    } catch (testResultError: unknown) {
      setTestResultState({
        vehicleId: selectedVehicleId,
        status: "error",
        result: null,
        error:
          testResultError instanceof Error
            ? testResultError.message
            : "Saved Test Mode results could not be read.",
      });
    }
  }, [isAdmin, selectedVehicleId]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const searchText = search.toLowerCase();

      const matchesSearch = [
        vehicle.registration_number,
        vehicle.make,
        vehicle.model,
        vehicle.variant ?? "",
        vehicle.chassis_number ?? "",
        vehicle.engine_number ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchText);

      const matchesType =
        typeFilter === "all" || vehicle.vehicle_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [vehicles, search, typeFilter]);

  function updateField(
    field: keyof typeof initialForm,
    value: string
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function registerVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      registration_number: form.registration_number.trim().toUpperCase(),
      make: form.make.trim(),
      model: form.model.trim(),
      variant: form.variant.trim() || null,
      vehicle_type: form.vehicle_type,
      fuel_type: form.fuel_type || null,
      engine_capacity: form.engine_capacity.trim() || null,
      manufacturing_year: form.manufacturing_year
        ? Number(form.manufacturing_year)
        : null,
      registration_year: form.registration_year
        ? Number(form.registration_year)
        : null,
      colour: form.colour.trim() || null,
      chassis_number: form.chassis_number.trim() || null,
      engine_number: form.engine_number.trim() || null,
      odometer_reading_km: form.odometer_reading_km
        ? Number(form.odometer_reading_km)
        : null,
      owner_count: form.owner_count ? Number(form.owner_count) : null,
      created_by: actorId,
    };

    if (!authorized || !actorId) {
      setError("An authenticated active inspector or admin profile is required.");
      setSaving(false);
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from("vehicles")
        .insert(payload)
        .select(
          "id, registration_number, make, model, variant, vehicle_type, fuel_type, engine_capacity, manufacturing_year, registration_year, colour, chassis_number, engine_number, odometer_reading_km, owner_count, created_at"
        )
        .single();

      if (insertError?.code === "23505") {
        setError("This registration number already exists.");
        return;
      }
      if (insertError) {
        throw new Error(`Vehicle registration failed: ${insertError.message}`);
      }
      if (!data) throw new Error("Supabase did not confirm the registered vehicle.");

      setVehicles((current) => [data, ...current]);
      setSuccess("Vehicle registered in Supabase.");
      setForm(initialForm);
      setShowForm(false);
    } catch (registrationError: unknown) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : "Vehicle registration failed."
      );
    } finally {
      setSaving(false);
    }
  }

  const motorcycleCount = vehicles.filter(
    (v) => v.vehicle_type === "motorcycle"
  ).length;

  const scooterCount = vehicles.filter(
    (v) => v.vehicle_type === "scooter"
  ).length;

  return (
    <main className="min-h-screen bg-[#F7F6F1] p-5 text-[#26352B] md:p-8">
      <div className="mx-auto max-w-[1500px]">

        {/* HEADER */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center gap-2 text-sm text-[#788176] hover:text-[#28543D]"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#E8F1E8] p-3 text-[#28543D]">
                <Bike size={25} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Vehicle Management
                </h1>
                <p className="mt-1 text-sm text-[#858A80]">
                  Register and manage workshop vehicles stored in Supabase
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AuthControls />
            {canRegister && (
              <button
                disabled={!authorized || loading}
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E98A32] px-5 py-3 text-sm font-bold text-[#172E22] shadow-sm transition hover:bg-[#D87925] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={18} /> Register Vehicle
              </button>
            )}
          </div>
        </header>

        {!authorized && !loading && !error && (
          <div
            className="mb-5 flex items-start gap-3 rounded-xl border border-[#E8D6B8] bg-[#FFF6E9] p-4 text-sm text-[#80643A]"
            role="alert"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <span>
              Sign in with an active workshop account to view vehicles. Vehicle registration is restricted to admin and inspector roles.
            </span>
            <Link
              href="/login"
              className="ml-auto shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#28543D]"
            >
              Staff sign in
            </Link>
          </div>
        )}

        {/* ALERTS */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={19} /> {success}
          </div>
        )}

        {/* STAT CARDS */}
        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Vehicles" value={vehicles.length} icon={<Bike size={21} />} />
          <StatCard label="Motorcycles" value={motorcycleCount} icon={<Gauge size={21} />} />
          <StatCard label="Scooters" value={scooterCount} icon={<Bike size={21} />} />
        </section>

        {/* VEHICLE LIST */}
        <section className="overflow-hidden rounded-2xl border border-[#E8E5DC] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F0EEE7] p-5">
            <div>
              <h2 className="font-bold">Registered Vehicles</h2>
              <p className="mt-1 text-xs text-[#92968C]">
                {filteredVehicles.length} vehicles found
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-[#E8E5DC] px-3">
                <Search size={17} className="text-[#969B91]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search registration, model..."
                  className="w-48 bg-transparent py-2.5 text-sm outline-none sm:w-64"
                />
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[#E8E5DC] px-3">
                <Filter size={16} className="text-[#969B91]" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-transparent py-2.5 text-sm outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="scooter">Scooter</option>
                </select>
              </div>

              <button
                onClick={loadVehicles}
                disabled={loading}
                className="rounded-xl border border-[#E8E5DC] p-3 text-[#526455] hover:bg-[#F7F6F1]"
                title="Refresh"
              >
                <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left">
              <thead className="bg-[#F8F7F2] text-[10px] font-bold uppercase tracking-wider text-[#858B80]">
                <tr>
                  <th className="px-5 py-4">Vehicle</th>
                  <th className="px-4 py-4">Registration</th>
                  <th className="px-4 py-4">Type</th>
                  <th className="px-4 py-4">Year</th>
                  <th className="px-4 py-4">Odometer</th>
                  <th className="px-4 py-4">Added</th>
                  <th className="px-4 py-4">Details</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-sm text-[#92968C]">
                      <Loader2 size={22} className="mx-auto mb-2 animate-spin" />
                      Loading vehicles...
                    </td>
                  </tr>
                ) : filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Bike size={35} className="mx-auto mb-3 text-[#C6CBBF]" />
                      <p className="font-semibold text-[#536052]">No vehicles found</p>
                      <p className="mt-1 text-xs text-[#999E94]">
                        Register a vehicle or change your search.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => (
                    <tr
                      key={vehicle.id}
                      className="border-t border-[#F0EEE7] transition hover:bg-[#FBFAF7]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-[#EEF3EB] p-2.5 text-[#28543D]">
                            <Bike size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold">
                              {vehicle.make} {vehicle.model}
                            </p>
                            <p className="mt-1 text-xs text-[#989C92]">
                              {vehicle.variant || "Standard variant"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm font-bold">
                        {vehicle.registration_number}
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-[#EDF3EB] px-3 py-1.5 text-xs font-semibold capitalize text-[#315B3E]">
                          {vehicle.vehicle_type}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-[#6F786D]">
                        {vehicle.manufacturing_year ?? "—"}
                      </td>

                      <td className="px-4 py-4 text-sm text-[#6F786D]">
                        {vehicle.odometer_reading_km != null
                          ? `${vehicle.odometer_reading_km.toLocaleString("en-IN")} km`
                          : "—"}
                      </td>

                      <td className="px-4 py-4 text-xs text-[#92968C]">
                        {new Date(vehicle.created_at).toLocaleDateString("en-IN")}
                      </td>

                      <td className="px-4 py-4">
                        <button
                          onClick={() => setSelectedVehicle(vehicle)}
                          className="rounded-lg border border-[#E8E5DC] p-2 text-[#315B3E] hover:bg-[#EDF3EB]"
                          aria-label="View vehicle details"
                        >
                          <Eye size={17} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* REGISTRATION MODAL */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10271C]/60 p-3 backdrop-blur-sm">
            <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EEECE5] bg-white p-5">
                <div>
                  <h2 className="text-lg font-bold">Register New Vehicle</h2>
                  <p className="mt-1 text-xs text-[#92968C]">
                    Enter vehicle information to add it to the workshop
                  </p>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-2 hover:bg-[#F4F2EC]"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={registerVehicle} className="space-y-6 p-5">
                <div>
                  <h3 className="mb-4 text-sm font-bold text-[#315B3E]">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Registration Number *">
                      <input required value={form.registration_number} onChange={(e) => updateField("registration_number", e.target.value)} placeholder="KL-XX-XX-XXXX" className="form-input" />
                    </Field>
                    <Field label="Vehicle Type *">
                      <select value={form.vehicle_type} onChange={(e) => updateField("vehicle_type", e.target.value)} className="form-input">
                        <option value="motorcycle">Motorcycle</option>
                        <option value="scooter">Scooter</option>
                      </select>
                    </Field>
                    <Field label="Manufacturer *">
                      <input required value={form.make} onChange={(e) => updateField("make", e.target.value)} placeholder="Honda, TVS, Bajaj..." className="form-input" />
                    </Field>
                    <Field label="Model *">
                      <input required value={form.model} onChange={(e) => updateField("model", e.target.value)} placeholder="Activa, Pulsar..." className="form-input" />
                    </Field>
                    <Field label="Variant">
                      <input value={form.variant} onChange={(e) => updateField("variant", e.target.value)} placeholder="Standard, Deluxe..." className="form-input" />
                    </Field>
                    <Field label="Fuel Type">
                      <select value={form.fuel_type} onChange={(e) => updateField("fuel_type", e.target.value)} className="form-input">
                        <option>Petrol</option>
                        <option>Electric</option>
                        <option>Diesel</option>
                        <option>Hybrid</option>
                      </select>
                    </Field>
                    <Field label="Engine Capacity">
                      <input value={form.engine_capacity} onChange={(e) => updateField("engine_capacity", e.target.value)} placeholder="150cc / 110cc" className="form-input" />
                    </Field>
                    <Field label="Colour">
                      <input value={form.colour} onChange={(e) => updateField("colour", e.target.value)} placeholder="Black" className="form-input" />
                    </Field>
                  </div>
                </div>

                <div className="border-t border-[#EEECE5] pt-5">
                  <h3 className="mb-4 text-sm font-bold text-[#315B3E]">
                    Registration & Identification
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Manufacturing Year">
                      <input type="number" min="1950" max="2100" value={form.manufacturing_year} onChange={(e) => updateField("manufacturing_year", e.target.value)} placeholder="2022" className="form-input" />
                    </Field>
                    <Field label="Registration Year">
                      <input type="number" min="1950" max="2100" value={form.registration_year} onChange={(e) => updateField("registration_year", e.target.value)} placeholder="2023" className="form-input" />
                    </Field>
                    <Field label="Chassis Number">
                      <input value={form.chassis_number} onChange={(e) => updateField("chassis_number", e.target.value)} className="form-input" />
                    </Field>
                    <Field label="Engine Number">
                      <input value={form.engine_number} onChange={(e) => updateField("engine_number", e.target.value)} className="form-input" />
                    </Field>
                    <Field label="Odometer (KM)">
                      <input type="number" min="0" value={form.odometer_reading_km} onChange={(e) => updateField("odometer_reading_km", e.target.value)} placeholder="25000" className="form-input" />
                    </Field>
                    <Field label="Number of Previous Owners">
                      <select value={form.owner_count} onChange={(e) => updateField("owner_count", e.target.value)} className="form-input">
                        <option value="1">1 Owner</option>
                        <option value="2">2 Owners</option>
                        <option value="3">3 Owners</option>
                        <option value="4">4+ Owners</option>
                      </select>
                    </Field>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3 border-t border-[#EEECE5] pt-5">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-xl border border-[#E4E2D9] px-5 py-3 text-sm font-semibold text-[#596357]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#E98A32] px-6 py-3 text-sm font-bold text-[#172E22] disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
                    {saving ? "Saving..." : "Register Vehicle"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VEHICLE DETAILS */}
        {selectedVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10271C]/60 p-3 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold">Vehicle Details</h2>
                <button onClick={() => setSelectedVehicle(null)} className="rounded-lg p-2 hover:bg-[#F4F2EC]">
                  <X size={20} />
                </button>
              </div>
              <div className="mb-5 flex items-center gap-4 rounded-xl bg-[#F4F5EF] p-4">
                <div className="rounded-xl bg-[#E3EDE1] p-3 text-[#315B3E]">
                  <Bike size={30} />
                </div>
                <div>
                  <p className="font-bold">{selectedVehicle.make} {selectedVehicle.model}</p>
                  <p className="mt-1 text-sm text-[#7C8579]">{selectedVehicle.registration_number}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Type" value={selectedVehicle.vehicle_type} />
                <Detail label="Variant" value={selectedVehicle.variant} />
                <Detail label="Fuel" value={selectedVehicle.fuel_type} />
                <Detail label="Engine" value={selectedVehicle.engine_capacity} />
                <Detail label="Manufacturing Year" value={selectedVehicle.manufacturing_year} />
                <Detail label="Registration Year" value={selectedVehicle.registration_year} />
                <Detail label="Colour" value={selectedVehicle.colour} />
                <Detail label="Odometer" value={selectedVehicle.odometer_reading_km != null ? `${selectedVehicle.odometer_reading_km} KM` : null} />
                <Detail label="Chassis Number" value={selectedVehicle.chassis_number} />
                <Detail label="Engine Number" value={selectedVehicle.engine_number} />
                <Detail label="Owners" value={selectedVehicle.owner_count} />
              </div>
              {isAdmin && (
                <VehicleTestResultsSection
                  state={testResultState}
                  vehicleId={selectedVehicle.id}
                  expandedResultId={expandedTestResultId}
                  onToggleDetails={(resultId) =>
                    setExpandedTestResultId((current) =>
                      current === resultId ? "" : resultId
                    )
                  }
                />
              )}
            </div>
          </div>
        )}

      </div>

      <style jsx>{`
        .form-input {
          width: 100%;
          border: 1px solid #e5e3da;
          border-radius: 10px;
          padding: 11px 12px;
          font-size: 13px;
          color: #344337;
          background: #fff;
          outline: none;
        }
        .form-input:focus {
          border-color: #63866b;
          box-shadow: 0 0 0 3px rgba(49, 91, 62, 0.08);
        }
      `}</style>
    </main>
  );
}

function VehicleTestResultsSection({
  state,
  vehicleId,
  expandedResultId,
  onToggleDetails,
}: {
  state: {
    vehicleId: string;
    status: "idle" | "loading" | "ready" | "error";
    result: TestModeResult | null;
    error: string;
  };
  vehicleId: string;
  expandedResultId: string;
  onToggleDetails: (resultId: string) => void;
}) {
  const isCurrentVehicle = state.vehicleId === vehicleId;
  const result = isCurrentVehicle ? state.result : null;
  const isLoading =
    state.status === "loading" || !isCurrentVehicle;
  const isError = isCurrentVehicle && state.status === "error";

  return (
    <section className="mt-6 border-t border-[#E8E5DC] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#28543D]">
          Inspection Test Results
        </h3>
        <span className="rounded-full bg-[#FFF0E0] px-3 py-1.5 text-[9px] font-extrabold tracking-wide text-[#A95719]">
          TEST DATA / SIMULATION
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-5 text-[#92968C]">
        Local Test Mode results only. They are separate from live inspection
        history, official ratings, certificates, repairs, and QC records.
      </p>

      {isLoading ? (
        <p className="mt-4 text-xs text-[#697568]" role="status">
          Loading local simulation result…
        </p>
      ) : isError ? (
        <p
          className="mt-4 rounded-xl border border-[#EBC4BA] bg-[#FCE9E5] p-3 text-xs leading-5 text-[#9F4A3A]"
          role="alert"
        >
          Saved Test Mode data is unavailable: {state.error} No test result is
          being shown as a live inspection.
        </p>
      ) : !result ? (
        <p className="mt-4 rounded-xl bg-[#FCFBF7] p-3 text-xs leading-5 text-[#697568]">
          No saved Test Mode result exists for this vehicle in this browser.
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-[#E9D1A8] bg-[#FFFBF4] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#344337]">
                  {result.registrationNumber} · {result.vehicleType}
                </p>
                <p className="mt-1 text-[10px] text-[#7C8579]">
                  Simulated at{" "}
                  {new Date(result.simulatedAt).toLocaleString("en-IN")}
                </p>
              </div>
              <span className="rounded-full bg-[#FFF0E0] px-2.5 py-1 text-[8px] font-extrabold text-[#A95719]">
                TEST DATA
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <TestResultValue
                label="Progress"
                value={`${result.counts.completed}/${result.counts.applicable} complete`}
              />
              <TestResultValue
                label="Pending / unresolved"
                value={`${result.counts.pending} / ${result.counts.unresolved}`}
              />
              <TestResultValue
                label="Simulated evidence"
                value={`${result.evidenceStatus.simulatedMediaCount}/${result.evidenceStatus.requiredMediaCount} media · ${result.evidenceStatus.missingMediaCount} missing`}
              />
              <TestResultValue
                label="Simulated safety"
                value={result.safetyStatus}
                alert={result.safetyStatus !== "CLEARED"}
              />
            </div>

            {result.criticalFailures.length > 0 && (
              <div className="mt-3 rounded-lg bg-[#FCE9E5] p-3 text-[10px] text-[#9F4A3A]">
                <p className="font-bold">
                  Simulated critical failures ({result.criticalFailures.length})
                </p>
                <ul className="mt-1 space-y-1">
                  {result.criticalFailures.map((failure) => (
                    <li key={failure.checkpointNo}>
                      #{failure.checkpointNo} · {failure.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => onToggleDetails(result.id)}
              className="mt-4 rounded-lg border border-[#D8C6A9] bg-white px-3 py-2 text-[10px] font-bold text-[#805B2E] transition hover:bg-[#FFF6E9]"
              aria-expanded={expandedResultId === result.id}
            >
              {expandedResultId === result.id
                ? "Hide checkpoint details"
                : `View checkpoint details (${result.checkpoints.length})`}
            </button>
          </div>

          {expandedResultId === result.id && (
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-[#E8E5DC] bg-[#FCFBF7] p-3">
              {result.checkpoints.map((checkpoint) => (
                <article
                  key={checkpoint.checkpointNo}
                  className="rounded-lg border border-[#EEECE5] bg-white p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-[#344337]">
                        #{checkpoint.checkpointNo} · {checkpoint.name}
                      </p>
                      <p className="mt-1 text-[9px] text-[#92968C]">
                        Section {checkpoint.sectionNo} · {checkpoint.sectionName}
                        {" · "}
                        {checkpoint.classification} · {checkpoint.assessmentMethod}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#F3F0E7] px-2 py-1 text-[8px] font-bold uppercase text-[#697568]">
                      {checkpoint.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-[#697568]">
                    {checkpoint.assessment.resultStatus && (
                      <span>
                        Result: {checkpoint.assessment.resultStatus.replace("_", " ")}
                      </span>
                    )}
                    {checkpoint.assessment.cosmeticScore !== null && (
                      <span>
                        Cosmetic: {checkpoint.assessment.cosmeticScore}/5
                      </span>
                    )}
                    {checkpoint.assessment.measuredValue && (
                      <span>
                        Measured: {checkpoint.assessment.measuredValue}{" "}
                        {checkpoint.assessment.measuredUnit}
                      </span>
                    )}
                    {checkpoint.assessment.expectedValue && (
                      <span>
                        Test reference: {checkpoint.assessment.expectedValue}
                      </span>
                    )}
                    {checkpoint.assessment.recordedValue && (
                      <span>
                        Recorded: {checkpoint.assessment.recordedValue}
                      </span>
                    )}
                    {checkpoint.assessment.matchStatus && (
                      <span>Match: {checkpoint.assessment.matchStatus}</span>
                    )}
                    {checkpoint.assessment.countValue && (
                      <span>Count: {checkpoint.assessment.countValue}</span>
                    )}
                    {checkpoint.assessment.isDisclosed !== null && (
                      <span>
                        Disclosure:{" "}
                        {checkpoint.assessment.isDisclosed
                          ? "Disclosed"
                          : "Undisclosed"}
                      </span>
                    )}
                    {checkpoint.autoValue && (
                      <span>Automatic value: {checkpoint.autoValue}</span>
                    )}
                  </div>
                  {checkpoint.evidence.length > 0 && (
                    <p className="mt-2 text-[8px] font-bold uppercase text-[#A95719]">
                      {checkpoint.evidence
                        .map((item) => item.label)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="mt-2 text-[9px] text-[#697568]">
                    Evidence required: {checkpoint.evidenceRequired} ·{" "}
                    {getTestEvidenceStatus(checkpoint)}
                  </p>
                  {checkpoint.assessment.observation && (
                    <p className="mt-2 text-[9px] text-[#697568]">
                      Observation: {checkpoint.assessment.observation}
                    </p>
                  )}
                  {checkpoint.assessment.issueDescription && (
                    <p className="mt-2 text-[9px] text-[#697568]">
                      Simulated issue: {checkpoint.assessment.issueDescription}
                    </p>
                  )}
                  {checkpoint.criticalFailure && (
                    <p className="mt-2 text-[9px] font-bold text-[#B44936]">
                      Simulated critical failure · TEST DATA
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TestResultValue({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white p-2.5">
      <p className="text-[8px] font-bold uppercase tracking-wide text-[#92968C]">
        {label} · TEST DATA
      </p>
      <p
        className={`mt-1 break-words text-[10px] font-bold ${
          alert ? "text-[#B44936]" : "text-[#344337]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function getTestEvidenceStatus(
  checkpoint: TestModeCheckpointResult
): string {
  if (
    checkpoint.status === "not_applicable" ||
    checkpoint.evidenceRequired === "Not required"
  ) {
    return "Not required";
  }

  const mediaTypes = new Set(
    checkpoint.evidence.map((item) => item.mediaType)
  );
  const hasRequiredMedia =
    checkpoint.evidenceRequired === "Photo+Video"
      ? mediaTypes.has("photo") && mediaTypes.has("video")
      : mediaTypes.has(
          checkpoint.evidenceRequired === "Photo" ? "photo" : "video"
        );
  return hasRequiredMedia ? "Simulated evidence present" : "Missing";
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E5DC] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#7D8579]">{label}</p>
        <div className="rounded-xl bg-[#EAF1E7] p-2.5 text-[#315B3E]">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-[#26352B]">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-[#697568]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-xl bg-[#F7F6F1] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#92968C]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold capitalize text-[#344337]">
        {value ?? "Not provided"}
      </p>
    </div>
  );
}
