import {
  ReleaseFeatures,
  type ReleaseFeatureGroup,
} from "@/components/ReleaseFeatures";
import { getStoryDescopes } from "@/lib/release-content";

/**
 * Home's features card, once the descope history has resolved.
 *
 * Split from the card itself so it can sit behind a Suspense boundary:
 * the fallback renders the identical list without descope markers, so the
 * page never waits on the issue-history read and nothing moves when it
 * lands except the amber tags appearing.
 *
 * A Linear failure is already swallowed by getStoryDescopes, which returns
 * an empty map — so the worst case here is the fallback's own output.
 */
export async function ReleaseFeaturesWithDescopes({
  groups,
  loadedReleases,
}: {
  groups: ReleaseFeatureGroup[];
  /** The releases whose content is on the page; the rest load on reveal. */
  loadedReleases: string[];
}) {
  // Scoped to the releases actually rendered. Asking for every release's
  // descope history to annotate two of them was the same over-fetch the
  // content read just stopped doing.
  const descopes = await getStoryDescopes(loadedReleases);
  return (
    <ReleaseFeatures
      groups={groups}
      descopes={descopes}
      loadedReleases={loadedReleases}
    />
  );
}
