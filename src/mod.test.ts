import { assertEquals, assertThrows } from "@std/assert";
import { runtimeQuery } from "./mod.ts";

/** Creates a minimal context-like object with the given update for testing. */
// deno-lint-ignore no-explicit-any
function ctx(update: Record<string, any>): any {
    return { update };
}

Deno.test("L1 query matches correct update type", () => {
    const pred = runtimeQuery("message");
    assertEquals(pred(ctx({ message: { text: "hello" } })), true);
    assertEquals(pred(ctx({ channel_post: { text: "hello" } })), false);
    assertEquals(pred(ctx({})), false);
});

Deno.test("L2 query matches correct property", () => {
    const pred = runtimeQuery("message:photo");
    assertEquals(pred(ctx({ message: { photo: [{}] } })), true);
    assertEquals(pred(ctx({ message: { text: "hello" } })), false);
});

Deno.test("L3 query matches entity type", () => {
    const pred = runtimeQuery("message:entities:url");
    assertEquals(
        pred(ctx({ message: { entities: [{ type: "url" }] } })),
        true,
    );
    assertEquals(
        pred(ctx({ message: { entities: [{ type: "bold" }] } })),
        false,
    );
});

Deno.test("L3 query matches property name", () => {
    const pred = runtimeQuery("message:sticker:is_video");
    assertEquals(
        pred(ctx({ message: { sticker: { is_video: true } } })),
        true,
    );
    assertEquals(
        pred(ctx({ message: { sticker: { is_animated: true } } })),
        false,
    );
});

Deno.test("L1 shortcut: empty string expands to message + channel_post", () => {
    const pred = runtimeQuery(":photo");
    assertEquals(pred(ctx({ message: { photo: [{}] } })), true);
    assertEquals(pred(ctx({ channel_post: { photo: [{}] } })), true);
    assertEquals(pred(ctx({ edited_message: { photo: [{}] } })), false);
});

Deno.test("L1 shortcut: msg expands to message + channel_post", () => {
    const pred = runtimeQuery("msg:photo");
    assertEquals(pred(ctx({ message: { photo: [{}] } })), true);
    assertEquals(pred(ctx({ channel_post: { photo: [{}] } })), true);
});

Deno.test("L1 shortcut: edit expands to edited_message + edited_channel_post", () => {
    const pred = runtimeQuery("edit:text");
    assertEquals(pred(ctx({ edited_message: { text: "hi" } })), true);
    assertEquals(pred(ctx({ edited_channel_post: { text: "hi" } })), true);
    assertEquals(pred(ctx({ message: { text: "hi" } })), false);
});

Deno.test("L2 shortcut: media expands to photo + video", () => {
    const pred = runtimeQuery("message:media");
    assertEquals(pred(ctx({ message: { photo: [{}] } })), true);
    assertEquals(pred(ctx({ message: { video: {} } })), true);
    assertEquals(pred(ctx({ message: { audio: {} } })), false);
});

Deno.test("L2 shortcut: file expands to all file types", () => {
    const pred = runtimeQuery("message:file");
    assertEquals(pred(ctx({ message: { photo: [{}] } })), true);
    assertEquals(pred(ctx({ message: { audio: {} } })), true);
    assertEquals(pred(ctx({ message: { document: {} } })), true);
    assertEquals(pred(ctx({ message: { sticker: {} } })), true);
    assertEquals(pred(ctx({ message: { text: "hi" } })), false);
});

Deno.test("L2 shortcut: empty string expands to entities + caption_entities", () => {
    const pred = runtimeQuery("message::url");
    assertEquals(
        pred(ctx({ message: { entities: [{ type: "url" }] } })),
        true,
    );
    assertEquals(
        pred(ctx({ message: { caption_entities: [{ type: "url" }] } })),
        true,
    );
});

Deno.test("combined L1 + L2 shortcuts", () => {
    const pred = runtimeQuery(":media");
    assertEquals(pred(ctx({ message: { photo: [{}] } })), true);
    assertEquals(pred(ctx({ message: { video: {} } })), true);
    assertEquals(pred(ctx({ channel_post: { photo: [{}] } })), true);
});

Deno.test("key use case: :media:media_group_id", () => {
    const pred = runtimeQuery(":media:media_group_id");
    assertEquals(
        pred(ctx({ message: { photo: [{ media_group_id: "123" }] } })),
        true,
    );
    assertEquals(
        pred(ctx({ message: { video: { media_group_id: "456" } } })),
        true,
    );
    assertEquals(
        pred(
            ctx({
                channel_post: { photo: [{ media_group_id: "789" }] },
            }),
        ),
        true,
    );
    assertEquals(
        pred(ctx({ message: { photo: [{ file_id: "123" }] } })),
        false,
    );
});

Deno.test("multiple queries (array) use OR logic", () => {
    const pred = runtimeQuery([":photo", ":video"]);
    assertEquals(pred(ctx({ message: { photo: [{}] } })), true);
    assertEquals(pred(ctx({ message: { video: {} } })), true);
    assertEquals(pred(ctx({ message: { audio: {} } })), false);
});

Deno.test("arbitrary L3 property works at runtime", () => {
    const pred = runtimeQuery("message:photo:file_size");
    assertEquals(
        pred(ctx({ message: { photo: [{ file_size: 1024 }] } })),
        true,
    );
    assertEquals(
        pred(ctx({ message: { photo: [{ width: 100 }] } })),
        false,
    );
});

Deno.test("L1 only queries", () => {
    const pred = runtimeQuery("inline_query");
    assertEquals(
        pred(ctx({ inline_query: { id: "1", query: "test" } })),
        true,
    );
    assertEquals(pred(ctx({ message: {} })), false);
});

Deno.test("callback_query:data", () => {
    const pred = runtimeQuery("callback_query:data");
    assertEquals(pred(ctx({ callback_query: { data: "test" } })), true);
    assertEquals(
        pred(ctx({ callback_query: { game_short_name: "test" } })),
        false,
    );
});

Deno.test("empty query throws", () => {
    assertThrows(
        () => {
            const pred = runtimeQuery("");
            pred(ctx({}));
        },
        Error,
        "Empty filter query given",
    );
});
