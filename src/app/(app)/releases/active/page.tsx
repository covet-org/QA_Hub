import type { Metadata } from "next";
import { RunsView } from "../RunsView";

export const metadata: Metadata = { title: "Releases · Active" };

export default function ActiveReleasesPage() {
  return <RunsView state="active" />;
}
