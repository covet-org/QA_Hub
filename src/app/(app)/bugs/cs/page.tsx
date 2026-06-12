import type { Metadata } from "next";
import { BugsView } from "../BugsView";

export const metadata: Metadata = { title: "CS Bugs" };

export default function CsBugsPage() {
  return <BugsView kind="cs" />;
}
