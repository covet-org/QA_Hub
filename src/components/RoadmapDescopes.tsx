import { descopesForStory } from "@/lib/descope-history";
import { fetchReleaseProjectMoves } from "@/lib/linear/releases";
import { priorityRank } from "@/lib/priority";
import type { CoveredTicket, ReleaseGroup } from "@/lib/linear/types";
import { DataRow, Tag, TicketLink } from "@/components/ui";

/**
 * Roadmap tickets that were pushed out of a release before.
 *
 * Sits above the board because it answers a question the board cannot:
 * which of this work has already slipped once. A ticket that has been
 * descoped twice is not the same risk as one that has never been in a
 * release, and on the board proper they look identical.
 *
 * A section rather than a re-sort of the board itself: the history arrives
 * from the slowest call in the app, so it is streamed, and nothing below
 * may jump when it lands.
 *
 * The history is read for the projects the board is showing — roadmap
 * tickets sit in squad projects, not release projects, which is exactly
 * where a descoped ticket lands.
 */
function stamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function RoadmapDescopes({ groups }: { groups: ReleaseGroup[] }) {
  const projectNames = [...new Set(groups.map((g) => g.name))];
  if (projectNames.length === 0) return null;

  const moves = await fetchReleaseProjectMoves(projectNames).catch(() => null);
  if (!moves) return null;

  const rows = groups
    .flatMap((group) =>
      group.tickets.map((ticket: CoveredTicket) => ({
        ticket,
        group: group.name,
        // Null version: a ticket parked in a squad project is not under
        // any release, so every exit counts as history.
        descopes: descopesForStory(
          ticket.id,
          null,
          moves.descopesByFeature[ticket.id],
          [],
        ),
      })),
    )
    .filter((row) => row.descopes.length > 0)
    // Most recently slipped first, then by how often, then by priority:
    // the thing that fell out of the last release is the live problem.
    .sort(
      (a, b) =>
        b.descopes[0].at.localeCompare(a.descopes[0].at) ||
        b.descopes.length - a.descopes.length ||
        priorityRank(a.ticket.priorityName) -
          priorityRank(b.ticket.priorityName),
    );

  if (rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3">
        <h2 className="font-display text-[13px] font-semibold text-slate-800">
          Previously descoped
        </h2>
        <p className="text-[11px] text-slate-500">
          {rows.length} ticket{rows.length === 1 ? "" : "s"} pushed out of a
          release before — they are still on the board below
        </p>
      </div>

      <ul className="divide-y divide-hairline">
        {rows.map(({ ticket, group, descopes }) => {
          const latest = descopes[0];
          return (
            <DataRow
              key={ticket.id}
              leading={<TicketLink id={ticket.id} url={ticket.url} />}
              title={ticket.title}
              titleAttr={ticket.title}
              trailing={
                <>
                  <span
                    className="shrink-0 text-[11px] text-slate-400"
                    title={`Currently in ${group}`}
                  >
                    {group}
                  </span>
                  <Tag
                    className="bg-amber-50 text-amber-800 ring-amber-200"
                    title={descopes
                      .map(
                        (d) =>
                          `Pushed out of ${d.fromRelease} ${
                            d.toRelease
                              ? `into ${d.toRelease}`
                              : d.toProject
                                ? `into ${d.toProject}`
                                : "out of every project"
                          } on ${stamp(d.at)}`,
                      )
                      .join("\n")}
                  >
                    {descopes.length === 1
                      ? `descoped from ${latest.fromRelease}`
                      : `descoped ${descopes.length}×, last from ${latest.fromRelease}`}
                  </Tag>
                  <span className="nums shrink-0 text-[11px] text-slate-500">
                    {stamp(latest.at)}
                  </span>
                </>
              }
            />
          );
        })}
      </ul>
    </section>
  );
}
