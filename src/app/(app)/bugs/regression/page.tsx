import type { Metadata } from "next";
import { BugsView } from "../BugsView";

export const metadata: Metadata = { title: "Regression Bugs" };

export default function RegressionBugsPage() {
  return <BugsView kind="regression" />;
}
