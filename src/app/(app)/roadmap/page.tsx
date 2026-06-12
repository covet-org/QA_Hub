import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { InitiativeList } from "@/components/InitiativeList";
import { initiatives } from "@/content/initiatives";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  await requireSession();

  return (
    <div>
      <Hero
        kicker="QA Vision"
        title="QA Roadmap"
        description="Everything the QA team is building — from recurring release regression to the automation initiatives that will shrink it. Manual and automation effort allocation per initiative."
        footnote="Edited by QA leads in src/content/initiatives.ts"
      />
      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
        <InitiativeList initiatives={initiatives} />
      </div>
    </div>
  );
}
