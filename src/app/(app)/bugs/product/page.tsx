import type { Metadata } from "next";
import { BugsView } from "../BugsView";

export const metadata: Metadata = { title: "Bugs" };

export default function ProductBugsPage() {
  return <BugsView kind="product" />;
}
