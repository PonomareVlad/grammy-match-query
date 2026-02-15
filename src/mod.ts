/**
 * grammY Runtime Queries Plugin
 *
 * Interprets filter queries like grammY does, but supports any possible
 * combinations via runtime property checking — including queries that
 * grammY's static type system would reject.
 *
 * @example
 * ```ts
 * import { runtimeQuery } from 'grammy-runtime-queries'
 * bot.filter(runtimeQuery(':media:media_group_id'), ctx => {
 *   console.log('Media group')
 * })
 * ```
 */

import { Context } from "./deps.deno.ts";

// L1 shortcuts: map shortcut names to L1 update types
const L1_SHORTCUTS: Record<string, readonly string[]> = {
    "": ["message", "channel_post"],
    msg: ["message", "channel_post"],
    edit: ["edited_message", "edited_channel_post"],
};

// L2 shortcuts: map shortcut names to L2 message properties
const L2_SHORTCUTS: Record<string, readonly string[]> = {
    "": ["entities", "caption_entities"],
    media: ["photo", "video"],
    file: [
        "photo",
        "animation",
        "audio",
        "document",
        "video",
        "video_note",
        "voice",
        "sticker",
    ],
};

/**
 * Parse a filter query string into its component parts.
 */
function parse(query: string): string[] {
    return query.split(":");
}

/**
 * Expand shortcuts in a parsed query to produce all concrete query paths.
 */
function expand(parts: string[]): string[][] {
    const [l1, l2, l3] = parts;

    // Do not expand if all parts are empty/undefined
    if (!l1 && !l2 && !l3) return [parts];

    // Expand L1 shortcuts
    let expanded: string[][];
    if (l1 in L1_SHORTCUTS) {
        const targets = L1_SHORTCUTS[l1];
        expanded = targets.map((s) => [s, l2, l3]);
    } else {
        expanded = [[l1, l2, l3]];
    }

    // Expand L2 shortcuts
    expanded = expanded.flatMap((q) => {
        const [ql1, ql2, ql3] = q;
        if (ql2 !== undefined && ql2 in L2_SHORTCUTS) {
            const targets = L2_SHORTCUTS[ql2];
            return targets.map((s) => [ql1, s, ql3]);
        }
        return [q];
    });

    return expanded;
}

type Predicate = (obj: Record<string, unknown>) => boolean;

/**
 * Test a value that may be an array or a single item.
 */
function testMaybeArray<T>(
    t: T | T[],
    pred: (t: T) => boolean,
): boolean {
    const p = (x: T) => x != null && pred(x);
    return Array.isArray(t) ? t.some(p) : p(t);
}

/**
 * Build a predicate function for a single expanded query path.
 */
function buildPredicate(parts: string[]): Predicate {
    const [l1, l2, l3] = parts;

    if (l1 === undefined || l1 === "") {
        throw new Error("Empty filter query given");
    }

    return (update: Record<string, unknown>): boolean => {
        // Check L1: the update type property must exist
        const l1Value = update[l1];
        if (l1Value == null) return false;
        // L1-only query: just check existence
        if (l2 === undefined) return true;

        // Check L2: the L2 property must exist on the L1 object
        const l2Value = (l1Value as Record<string, unknown>)[l2];
        if (l2Value == null) return false;
        // L2-only query: just check existence
        if (l3 === undefined) return true;

        // Check L3: check sub-property on L2 value (may be array)
        return testMaybeArray(
            l2Value as Record<string, unknown> | Record<string, unknown>[],
            (item) =>
                (item[l3] !== undefined && item[l3] !== null) ||
                (item as Record<string, unknown>).type === l3,
        );
    };
}

/**
 * Compile multiple query paths into a single predicate (OR logic).
 */
function compile(paths: string[][]): Predicate {
    const predicates = paths.map(buildPredicate);
    return (update) => predicates.some((pred) => pred(update));
}

/**
 * Create a runtime filter predicate from a grammY-style filter query string.
 *
 * Unlike grammY's built-in `matchFilter`, this function does not validate
 * queries against a static set of known keys. Instead, it interprets the
 * query at runtime, checking if the specified properties exist on the
 * update object. This allows using any property path, including ones
 * that grammY's type system would reject (e.g. `:media:media_group_id`).
 *
 * Supports:
 * - L1, L2, and L3 queries (e.g. `message`, `message:photo`, `message:entities:url`)
 * - L1 shortcuts: `""` and `msg` expand to `message` + `channel_post`;
 *   `edit` expands to `edited_message` + `edited_channel_post`
 * - L2 shortcuts: `""` expands to `entities` + `caption_entities`;
 *   `media` expands to `photo` + `video`;
 *   `file` expands to `photo`, `animation`, `audio`, `document`, `video`, `video_note`, `voice`, `sticker`
 * - Multiple queries separated by logical OR (pass array or use multiple calls)
 *
 * @param query A filter query string or array of filter query strings
 * @returns A predicate function compatible with `bot.filter()`
 *
 * @example
 * ```ts
 * import { runtimeQuery } from 'grammy-runtime-queries'
 *
 * // Single query
 * bot.filter(runtimeQuery(':media:media_group_id'), ctx => {
 *   console.log('Media group')
 * })
 *
 * // Multiple queries (OR logic)
 * bot.filter(runtimeQuery([':photo', ':video']), ctx => {
 *   console.log('Photo or video')
 * })
 * ```
 */
export function runtimeQuery(
    query: string | string[],
): (ctx: Context) => boolean {
    const queries = Array.isArray(query) ? query : [query];
    const allPaths = queries.flatMap((q) => expand(parse(q)));
    const predicate = compile(allPaths);
    // deno-lint-ignore no-explicit-any
    return (ctx) => predicate(ctx.update as any);
}
