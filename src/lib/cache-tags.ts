/**
 * Tags on every cached upstream read, so a reload can throw them all away
 * at once.
 *
 * The caches exist because re-reading Linear and Testiny on every
 * navigation made the pages slow enough to time out. But a 5-minute cache
 * also means a change made in Linear a minute ago is invisible, however
 * hard someone presses reload — and "I changed it, the hub disagrees" is
 * worse than a slow page. Tagging every entry makes the two compatible:
 * moving between pages is served from cache, and an actual reload
 * revalidates first.
 *
 * Two tags rather than one so a future caller can refresh just the side it
 * changed, and neither name is derived from a function name: these are
 * contracts between the reads and the refresh action.
 */
export const LINEAR_TAG = "upstream-linear";
export const TESTINY_TAG = "upstream-testiny";

/** Everything, for the reload path that cannot know what changed. */
export const ALL_UPSTREAM_TAGS = [LINEAR_TAG, TESTINY_TAG];
