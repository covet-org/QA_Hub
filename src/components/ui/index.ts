/**
 * QA Hub component library.
 *
 * Every page composes from these. The rule that keeps it a library rather
 * than a folder: a component takes its behaviour from props, so the same
 * filter serves the roadmap's releases, the bug board's priorities and
 * the initiative statuses — one look, one keyboard behaviour, three sets
 * of variables.
 *
 * Import from "@/components/ui", never from the individual files, so a
 * component can move without touching call sites.
 */
export { Card, CardBody, CardHeader } from "./Card";
export { DataRow, Meta, Slot, TicketLink } from "./DataRow";
export { Chevron, Disclosure, DisclosureRow } from "./Disclosure";
export { FilterBar, FilterGroup } from "./FilterGroup";
export type { FilterMode, FilterOption } from "./FilterGroup";
export { PageHeader } from "./PageHeader";
export { EmptyState, PageShell, SectionLabel } from "./PageShell";
export {
  DEFAULT_RELEASES_SHOWN,
  RevealMoreButton,
  useRevealMore,
} from "./RevealMore";
export {
  RunProgressBar,
  RunProgressLegend,
  runProgress,
  RUN_SEGMENTS,
} from "./RunProgress";
export type { RunProgressLike } from "./RunProgress";
export { StatCard } from "./StatCard";
export { UnderDevelopment } from "./UnderDevelopment";
export type { StatTone } from "./StatCard";
export { DotTag, Tag } from "./Tag";
export type { TagTone } from "./Tag";
