// One-off generator: builds src/lib/linear/sample-data.ts from a saved
// Linear MCP list_issues result, so the fixture mirrors real data.
// Usage: node scripts/build-linear-fixture.mjs <quick-wins.json> [medium.json...]
import { readFileSync, writeFileSync } from "node:fs";

const tickets = new Map();
for (const file of process.argv.slice(2)) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  for (const issue of data.issues) {
    if (issue.archivedAt) continue;
    const existing = tickets.get(issue.id);
    const roadmapLabels = (issue.labels ?? []).filter((l) =>
      ["Medium to Big Size Features", "Quick wins"].includes(l),
    );
    if (existing) {
      existing.labels = [...new Set([...existing.labels, ...roadmapLabels])];
      continue;
    }
    tickets.set(issue.id, {
      id: issue.id,
      title: issue.title,
      url: issue.url,
      status: issue.status,
      statusType: issue.statusType,
      labels: roadmapLabels,
      project: issue.project ?? null,
    });
  }
}

const list = [...tickets.values()];
const out = `import type { RoadmapTicket } from "@/lib/linear/types";

/**
 * Fixture shown when LINEAR_API_KEY is not configured — generated from
 * a real workspace snapshot (${new Date().toISOString().slice(0, 10)}) by
 * scripts/build-linear-fixture.mjs. Coverage matching against Testiny
 * still runs live against these.
 */
export const sampleTickets: RoadmapTicket[] = ${JSON.stringify(list, null, 2)};
`;
writeFileSync("src/lib/linear/sample-data.ts", out, "utf8");
console.log(`Wrote ${list.length} tickets to src/lib/linear/sample-data.ts`);
