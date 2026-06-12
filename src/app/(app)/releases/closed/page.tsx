import type { Metadata } from "next";
import { RunsView } from "../RunsView";

export const metadata: Metadata = { title: "Releases · Closed" };

export default function ClosedReleasesPage() {
  return <RunsView state="closed" />;
}
