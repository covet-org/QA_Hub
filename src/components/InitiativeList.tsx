"use client";

import { useMemo, useState } from "react";
import {
  statusMeta,
  type Initiative,
  type InitiativeStatus,
} from "@/content/initiatives";
import { AllocationBar } from "@/components/AllocationBar";
import { Tag } from "@/components/Tag";

const STATUS_FILTERS: { value: InitiativeStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-progress", label: "In Progress" },
  { value: "planned", label: "Planned" },
  { value: "investigation", label: "Investigation" },
  { value: "delivered", label: "Delivered" },
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function InitiativeRow({ initiative }: { initiative: Initiative }) {
  const [open, setOpen] = useState(false);
  const status = statusMeta[initiative.status];

  return (
    <li className="bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50"
      >
        <span className="flex-1 text-[15px] font-medium text-slate-800">
          {initiative.title}
        </span>
        <Tag>{initiative.area}</Tag>
        <Tag className={status.className}>{status.label}</Tag>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="border-t border-hairline px-5 py-4">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            {initiative.description}
          </p>
          <div className="mt-4 max-w-md">
            <AllocationBar
              manual={initiative.effort.manual}
              automation={initiative.effort.automation}
            />
          </div>
          {initiative.tags && initiative.tags.length > 0 && (
            <div className="mt-3 flex gap-1.5">
              {initiative.tags.map((tag) => (
                <Tag key={tag} className="bg-brand-50 text-brand-700 ring-brand-100">
                  {tag}
                </Tag>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function InitiativeList({ initiatives }: { initiatives: Initiative[] }) {
  const [filter, setFilter] = useState<InitiativeStatus | "all">("all");

  const visible = useMemo(
    () =>
      filter === "all"
        ? initiatives
        : initiatives.filter((i) => i.status === filter),
    [initiatives, filter],
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
              filter === f.value
                ? "bg-brand-800 text-white shadow-card"
                : "bg-surface-card text-slate-600 ring-1 ring-hairline hover:bg-surface-sunken"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="mt-4 divide-y divide-hairline overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline">
        {visible.map((initiative) => (
          <InitiativeRow key={initiative.id} initiative={initiative} />
        ))}
        {visible.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-slate-500">
            No initiatives with this status.
          </li>
        )}
      </ul>
    </div>
  );
}
