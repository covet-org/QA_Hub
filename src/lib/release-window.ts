/**
 * How many releases a Home card shows before you ask for more.
 *
 * Two, because the useful comparison is the release in flight against the
 * one before it. Everything older is history you go looking for.
 *
 * Neutral module on purpose — no "use client", no server-only. The cards
 * are client components and Home is a server component, and Home needs
 * this number to build links carrying the same releases the card is
 * showing. Importing it from RevealMore.tsx, which is a client module,
 * is the mistake that 500'd Home once already: see lib/slug.ts.
 */
export const DEFAULT_RELEASES_SHOWN = 2;
