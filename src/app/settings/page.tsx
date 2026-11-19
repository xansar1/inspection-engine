"use client";

import { useState } from "react";
import {
  Bell,
  Globe2,
  Save,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import {
  DemoMetricCard,
  DemoModulePage,
  DemoPanel,
  demoButtonClass,
} from "@/app/_components/DemoModuleShell";

const initialProfile = {
  workshopName: "Inspection Engine Demo Workshop",
  region: "Bengaluru, India",
  timeZone: "Asia/Kolkata",
  contactEmail: "demo@example.test",
};

const initialPreferences = {
  inspectionReminders: true,
  requireQcApproval: true,
  showDemoListings: true,
};

export default function SettingsPage() {
  const [profile, setProfile] = useState(initialProfile);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saved, setSaved] = useState(false);

  function updateProfile(field: keyof typeof initialProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function updatePreference(
    field: keyof typeof initialPreferences,
    checked: boolean
  ) {
    setPreferences((current) => ({ ...current, [field]: checked }));
    setSaved(false);
  }

  return (
    <DemoModulePage
      title="Workshop Settings"
      description="Preview workshop profile, general preferences and demo-mode configuration."
      icon={Settings}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetricCard label="Workspace" value="Demo" detail="No live settings connected" icon={Settings} />
        <DemoMetricCard label="Region" value="India" detail="Sample workshop locale" icon={Globe2} accent="orange" />
        <DemoMetricCard label="Inspection reminders" value={preferences.inspectionReminders ? "On" : "Off"} detail="Local demo preference" icon={Bell} />
        <DemoMetricCard label="QC approval gate" value={preferences.requireQcApproval ? "On" : "Off"} detail="Local demo preference" icon={SlidersHorizontal} accent="amber" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <DemoPanel
          title="Workshop profile"
          description="Sample profile values are editable in this page but are not sent to a database."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Workshop display name">
              <input
                value={profile.workshopName}
                onChange={(event) => updateProfile("workshopName", event.target.value)}
                className="settings-input"
              />
            </SettingsField>
            <SettingsField label="Region">
              <input
                value={profile.region}
                onChange={(event) => updateProfile("region", event.target.value)}
                className="settings-input"
              />
            </SettingsField>
            <SettingsField label="Time zone">
              <select
                value={profile.timeZone}
                onChange={(event) => updateProfile("timeZone", event.target.value)}
                className="settings-input"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="UTC">UTC</option>
              </select>
            </SettingsField>
            <SettingsField label="Contact email (demo)">
              <input
                type="email"
                value={profile.contactEmail}
                onChange={(event) => updateProfile("contactEmail", event.target.value)}
                className="settings-input"
              />
            </SettingsField>
          </div>
        </DemoPanel>

        <DemoPanel
          title="General preferences"
          description="Toggle sample workflow preferences for this browser session."
        >
          <div className="divide-y divide-[#F0EEE7]">
            <PreferenceToggle
              label="Inspection reminders"
              description="Show reminders for demo inspections awaiting completion."
              checked={preferences.inspectionReminders}
              onChange={(checked) => updatePreference("inspectionReminders", checked)}
            />
            <PreferenceToggle
              label="Require QC approval"
              description="Keep demo vehicles from becoming sale-ready before QC approval."
              checked={preferences.requireQcApproval}
              onChange={(checked) => updatePreference("requireQcApproval", checked)}
            />
            <PreferenceToggle
              label="Show sample sale listings"
              description="Display illustrative demo listings on the public homepage."
              checked={preferences.showDemoListings}
              onChange={(checked) => updatePreference("showDemoListings", checked)}
            />
          </div>
        </DemoPanel>
      </div>

      <DemoPanel
        title="Demo configuration"
        description="This workspace is currently showing illustrative values and sample records only."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <ConfigValue label="Data source" value="Frontend demo state" />
          <ConfigValue label="Distance unit" value="Kilometres (km)" />
          <ConfigValue label="Currency display" value="Indian Rupee (INR)" />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EEE7] pt-4">
          <p
            role="status"
            className={`text-xs ${saved ? "font-semibold text-[#26804B]" : "text-[#92958A]"}`}
          >
            {saved
              ? "Settings saved in this demo session only."
              : "Changes are temporary and will not be saved to the database."}
          </p>
          <button
            type="button"
            onClick={() => setSaved(true)}
            className={demoButtonClass}
          >
            <Save size={14} /> Save demo settings
          </button>
        </div>
      </DemoPanel>

      <style jsx>{`
        .settings-input {
          width: 100%;
          border: 1px solid #e8e3d8;
          border-radius: 10px;
          padding: 11px 12px;
          font-size: 13px;
          color: #344337;
          background: #faf9f5;
          outline: none;
        }
        .settings-input:focus {
          border-color: #63866b;
          box-shadow: 0 0 0 3px rgba(49, 91, 62, 0.08);
        }
      `}</style>
    </DemoModulePage>
  );
}

function SettingsField({
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

function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-4">
      <span>
        <span className="block text-xs font-semibold text-[#344337]">{label}</span>
        <span className="mt-1 block text-[10px] leading-5 text-[#92958A]">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#28543D]"
      />
    </label>
  );
}

function ConfigValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F3F4ED] p-4">
      <p className="text-[9px] font-bold uppercase tracking-wide text-[#92958A]">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#344337]">{value}</p>
    </div>
  );
}
