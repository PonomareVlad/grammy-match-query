import { assertEquals, assertThrows } from "@std/assert";
import { Api, Composer, Context } from "./deps.deno.ts";
import { runtimeQuery } from "./mod.ts";

// deno-lint-ignore no-explicit-any
const me = {} as any;

/** Creates a Context for testing. */
// deno-lint-ignore no-explicit-any
function createCtx(update: any): Context {
    return new Context(update, new Api(""), me);
}

/**
 * Uses Composer.filter with a runtimeQuery predicate and runs
 * the middleware against the given update. Returns whether the
 * filter matched (i.e. the handler inside .filter was invoked).
 */
async function testFilter(
    query: string | string[],
    // deno-lint-ignore no-explicit-any
    update: Record<string, any>,
): Promise<boolean> {
    let matched = false;
    const c = new Composer<Context>();
    c.filter(runtimeQuery(query), () => {
        matched = true;
    });
    const ctx = createCtx(update);
    await c.middleware()(ctx, async () => {});
    return matched;
}

Deno.test(
    "bot.filter(runtimeQuery(':media:media_group_id')) matches photo with media_group_id",
    async () => {
        assertEquals(
            await testFilter(":media:media_group_id", {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    photo: [{
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                    }],
                    media_group_id: "mg1",
                },
            }),
            true,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery(':media:media_group_id')) matches video with media_group_id",
    async () => {
        assertEquals(
            await testFilter(":media:media_group_id", {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    video: {
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                        duration: 1,
                    },
                    media_group_id: "mg2",
                },
            }),
            true,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery(':media:media_group_id')) matches channel_post photo with media_group_id",
    async () => {
        assertEquals(
            await testFilter(":media:media_group_id", {
                update_id: 1,
                channel_post: {
                    message_id: 1,
                    chat: { id: 1, type: "channel" },
                    date: 0,
                    photo: [{
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                    }],
                    media_group_id: "mg3",
                },
            }),
            true,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery(':media:media_group_id')) skips photo without media_group_id",
    async () => {
        assertEquals(
            await testFilter(":media:media_group_id", {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    photo: [{
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                    }],
                },
            }),
            false,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery(':media:media_group_id')) skips text message",
    async () => {
        assertEquals(
            await testFilter(":media:media_group_id", {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    text: "hello",
                },
            }),
            false,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery('message')) matches message",
    async () => {
        assertEquals(
            await testFilter("message", {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    text: "hello",
                },
            }),
            true,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery('message')) skips callback_query",
    async () => {
        assertEquals(
            await testFilter("message", {
                update_id: 1,
                callback_query: {
                    id: "1",
                    chat_instance: "1",
                    from: { id: 1, is_bot: false, first_name: "Test" },
                },
            }),
            false,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery('message:photo')) matches photo message",
    async () => {
        assertEquals(
            await testFilter("message:photo", {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    photo: [{
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                    }],
                },
            }),
            true,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery('message:entities:url')) matches url entity",
    async () => {
        assertEquals(
            await testFilter("message:entities:url", {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    text: "https://grammy.dev",
                    entities: [{ type: "url", offset: 0, length: 18 }],
                },
            }),
            true,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery(':photo')) expands L1 shortcut",
    async () => {
        assertEquals(
            await testFilter(":photo", {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    photo: [{
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                    }],
                },
            }),
            true,
        );

        assertEquals(
            await testFilter(":photo", {
                update_id: 2,
                channel_post: {
                    message_id: 1,
                    chat: { id: 1, type: "channel" },
                    date: 0,
                    photo: [{
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                    }],
                },
            }),
            true,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery('edit:text')) expands to edited_message + edited_channel_post",
    async () => {
        assertEquals(
            await testFilter("edit:text", {
                update_id: 1,
                edited_message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    edit_date: 1,
                    text: "edited",
                },
            }),
            true,
        );

        assertEquals(
            await testFilter("edit:text", {
                update_id: 2,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    text: "not edited",
                },
            }),
            false,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery('message:media')) expands L2 media shortcut",
    async () => {
        assertEquals(
            await testFilter("message:media", {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    photo: [{
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                    }],
                },
            }),
            true,
        );

        assertEquals(
            await testFilter("message:media", {
                update_id: 2,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    audio: {
                        file_id: "a",
                        file_unique_id: "b",
                        duration: 1,
                    },
                },
            }),
            false,
        );
    },
);

Deno.test(
    "bot.filter(runtimeQuery([':photo', ':video'])) uses OR logic",
    async () => {
        assertEquals(
            await testFilter([":photo", ":video"], {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    photo: [{
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                    }],
                },
            }),
            true,
        );

        assertEquals(
            await testFilter([":photo", ":video"], {
                update_id: 2,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    video: {
                        file_id: "a",
                        file_unique_id: "b",
                        width: 1,
                        height: 1,
                        duration: 1,
                    },
                },
            }),
            true,
        );

        assertEquals(
            await testFilter([":photo", ":video"], {
                update_id: 3,
                message: {
                    message_id: 1,
                    chat: { id: 1, type: "private" },
                    date: 0,
                    text: "hello",
                },
            }),
            false,
        );
    },
);

Deno.test("runtimeQuery with empty query throws", () => {
    assertThrows(
        () => {
            const pred = runtimeQuery("");
            pred(createCtx({}));
        },
        Error,
        "Empty filter query given",
    );
});
