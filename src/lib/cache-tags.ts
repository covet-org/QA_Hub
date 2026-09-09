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

/**
 * Closed releases: content that is finished and effectively immutable.
 *
 * A shipped release does not gain stories or change their labels. Its
 * content is cached for a day rather than five minutes, and — the part
 * that matters — a page load does NOT purge it. Re-reading 3.24 through
 * 3.36 on every visit is the single largest avoidable cost in the app,
 * and nothing about those releases has changed since they shipped.
 *
 * CS bugs are the known exception: they arrive against a release long
 * after it ships. They are read by a different query, under the live tag,
 * so they keep updating.
 */
export const ARCHIVE_TAG = "upstream-archive";

/** How long finished work is kept before being read again. */
export const ARCHIVE_REVALIDATE_SECONDS = 24 * 60 * 60;

/**
 * What a page load throws away: the live reads only.
 *
 * Purging the archive here would undo the point of having it — every
 * visit would re-read every shipped release.
 */
export const LIVE_UPSTREAM_TAGS = [LINEAR_TAG, TESTINY_TAG];

/** Everything, for an explicit "refresh now". */
export const ALL_UPSTREAM_TAGS = [LINEAR_TAG, TESTINY_TAG, ARCHIVE_TAG];
