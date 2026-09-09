"use server";

import {
  getRoadmapDescopes,
  type RoadmapDescopeMap,
} from "@/lib/roadmap-descopes";
import { requireAccess } from "@/lib/viewer";

/**
 * Descope history for roadmap groups the board has not loaded yet.
 *
 * The roadmap opens on Squad 4 - Cross-Product, so only that project's
 * issue history is read before the page renders. Reading every roadmap
 * project up front meant waiting on the slowest call in the app for
 * groups behind a filter nobody had opened.
 *
 * Access is re-checked: a server action is a public endpoint.
 */
export async function loadRoadmapDescopes(
  projectNames: string[],
): Promise<RoadmapDescopeMap> {
  await requireAccess("/roadmap");
  return getRoadmapDescopes(projectNames);
}
