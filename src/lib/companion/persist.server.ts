export { loadCompanionWorld, saveCompanionWorld } from "./persist";

/**
 * TanStack Start statically checks that server fn inputs/outputs are
 * serializable, and rejects `unknown`/`CompanionWorld` outright: the latter
 * has an intentionally-`unknown` field (`Insight.pendingPayload`, since a
 * pending mutation's shape varies by kind) the checker can't prove is
 * serializable, even though the actual JSON round-trip through Postgres
 * JSONB is fine. Sidestepped by trafficking a JSON STRING across this
 * boundary instead of a typed object — `string` is trivially serializable —
 * and parsing/stringifying at the client edge (use-companion-sync.ts). The
 * client's `normalizeWorld()` already treats any incoming world as
 * untrusted/partial and validates its shape regardless.
 */

/**
 * Server-side persistence for the companion world model — the durable
 * counterpart to the client's localStorage-persisted Zustand store
 * (src/lib/companion/store.ts). One JSONB row per signed-in user.
 *
 * This is deliberately dumb: it stores and returns whatever JSON blob the
 * client sends, with no per-field validation server-side. The client's own
 * `normalizeWorld()` (store.ts) is what guards against a malformed/partial
 * blob on the way back in — this file's only job is "the right user's row,
 * nothing else's."
 */

/** The saved world as a JSON string, or null if this user has never saved one yet. */
