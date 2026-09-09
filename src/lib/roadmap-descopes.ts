import "server-only";

import { descopesForStory } from "@/lib/descope-history";
import { fetchReleaseProjectMoves } from "@/lib/linear/releases";

/**
 * Which roadmap tickets were pushed out of a release before, keyed by id.
 *
 * Read for the projects the board is showing rather than the release
 * projects: a descoped ticket lands back in a squad project, which is
 * exactly where the roadmap finds it.
 *
 * Bugs are deliberately not paired in here. On a release panel a descope
 * carries "the bugs it had at that moment"; on the roadmap that would mean
 * a second expensive read for a tag, and a tag that said "no bugs" when
 * the truth is "we did not look" would be worse than no tag.
 *
 * Never rejects. The caller hands this promise straight to a client
 * component, where a rejection would surface as an error boundary over a
 * board that is otherwise fine.
 */
export interface RoadmapDescope {
  fromRelease: string;
  toProject: string | null;
  toRelease: string | null;
  at: string;
}

export type RoadmapDescopeMap = Record<string, RoadmapDescope[]>;

export async function getRoadmapDescopes(
  projectNames: string[],
): Promise<RoadmapDescopeMap> {
  if (projectNames.length === 0) return {};

  try {
    const moves = await fetchReleaseProjectMoves(projectNames);
    const out: RoadmapDescopeMap = {};
    for (const [id, events] of Object.entries(moves.descopesByFeature)) {
      // Null version: a roadmap ticket sits in a squad project and is not
      // under any release, so every exit is history worth showing. Routed
      // through the same helper the release panels use so both agree on
      // what an exit is and which order they read in.
      const descopes = descopesForStory(id, null, events, []);
      if (descopes.length > 0) {
        out[id] = descopes.map((d) => ({
          fromRelease: d.fromRelease,
          toProject: d.toProject,
          toRelease: d.toRelease,
          at: d.at,
        }));
      }
    }
    return out;
  } catch {
    return {};
  }
}
