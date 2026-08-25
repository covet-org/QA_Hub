"use client";

import { useMemo, useState } from "react";
import {
  statusMeta,
  type Initiative,
  type InitiativeStatus,
} from "@/content/initiatives";
import { AllocationBar } from "@/components/AllocationBar";
import { Chevron, FilterGroup, Tag } from "@/components/ui";

const STATUS_FILTERS: { value: InitiativeStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-progress", label: "In Progress" },
  { value: "planned", label: "Planned" },
  { value: "investigation", label: "Investigation" },
  { value: "delivered", label: "Delivered" },
];

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
        <span className="flex-1 text-sm font-medium text-slate-800">
          {initiative.title}
        </span>
        <Tag>{initiative.area}</Tag>
        <Tag className={status.className}>{status.label}</Tag>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="border-t border-hairline px-5 py-4">
          <p className="max-w-3xl text-[13px] leading-relaxed text-slate-600">
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
                <Tag
                  key={tag}
                  className="bg-brand-50 text-brand-700 ring-brand-100"
                >
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
      {/* The same FilterGroup the boards use — single-select here, with an
          explicit All chip because empty means "no filter". */}
      <FilterGroup
        label="Status"
        options={STATUS_FILTERS.filter((f) => f.value !== "all").map((f) => ({
          value: f.value,
          label: f.label,
        }))}
        selected={filter === "all" ? [] : [filter]}
        onChange={(next) => setFilter((next[0] as InitiativeStatus) ?? "all")}
        mode="single"
        emptyMeans="all"
        allLabel="All"
      />

      <ul className="mt-4 divide-y divide-hairline overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline">
        {visible.map((initiative) => (
          <InitiativeRow key={initiative.id} initiative={initiative} />
        ))}
        {visible.length === 0 && (
          <li className="px-5 py-10 text-center text-[13px] text-slate-500">
            No initiatives with this status.
          </li>
        )}
      </ul>
    </div>
  );
}
