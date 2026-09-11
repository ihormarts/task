# AI use

## Tools

**Claude (Opus)** — the whole build, in a single working session: architecture, the mock
services, the outbox and sync logic, the screens, the tests, and the first drafts of this
document and the README.

**Web search and fetch** — the App Store Review Guidelines and Google Play policy pages
for `docs/store-policies.md`. Those pages moved a lot in 2025 and 2026 and I did not want
to write about them from memory.

I did not use an autocomplete assistant in the editor for this exercise.

## How I worked

I treated the model as a fast pair, not an oracle. It is good at producing a plausible
shape quickly; it is not reliable about which shape is correct, and it will produce
something confident and wrong if the question is underspecified. So the loop was: decide
the design myself, have it write the mechanical parts, then read every line and run it.

The environment I was working in could not reach the npm registry, so for a stretch I had
code that had never been executed. That is exactly the condition under which generated
code looks finished and is not. The first real test run is described below, and it is the
most useful thing in this document.

## Output I corrected

**Two real bugs the first test run exposed.** Both were mine — I wrote the design, the
model wrote it down — and both were the kind of thing that reads fine and behaves badly.

1. The chat store subscribed to the whole network-conditions object and reacted to every
   change. Because the one-shot failure flag cleared itself through the same `update()`
   call, consuming an injected failure kicked off a pull and a flush that raced the
   caller's own. It now reacts only to an actual offline-to-online transition. Four tests
   failed in ways that looked unrelated to each other; the common cause took a while to
   see.

2. `flush()` returned immediately when a pass was already running. Under `await`, a caller
   could look at the outbox before the in-flight pass had drained it. It now waits for
   that pass, and runs once more if an untried message arrived while it waited, without
   pulling messages in backoff forward.

Neither showed up in review. Both showed up in the first `npx jest`.

**Client-side deduplication that hid the bug.** The first version of `mergeConfirmed` also
dropped confirmed messages that repeated a client id already in the thread. It made the
duplicate test pass. It was wrong: the server still held two copies, and the client was
quietly showing something different from what the server had — which would come back the
moment anyone paged through history. I removed it and rewrote the test to assert on the
server and on a client that reopens the thread. This is the correction I would want a
reviewer to ask me about.

**Dependency versions.** The model's first `package.json` used versions from memory. Since
the registry was unreachable, I read the real Expo SDK 57 versions out of the `sdk-57`
branch of `expo/expo` and pinned those. Two problems still surfaced on the first install:
`react-test-renderer` floating to 19.3 against Expo's pinned React 19.2.3, and
`babel-preset-expo` being nested inside `expo/node_modules` where babel could not resolve
it. Both are fixed by explicit pins rather than `--legacy-peer-deps`.

**FlashList v2 API.** The generated code used the v1 shape — `FlashList` as a ref type and
`maintainVisibleContentPosition={{ minIndexForVisible: 1 }}`. v2 exposes `FlashListRef`
and replaced that prop with `startRenderingFromBottom`, which is the one a chat actually
wants. Caught by `tsc`, fixed against the installed type definitions.

**Store policy text.** I did not let the model write this from memory. Every quotation in
`docs/store-policies.md` was fetched from the live Apple or Google page. Where I could not
verify wording — Google's user-generated content and inappropriate content policies — I
describe the requirement and link the page rather than quote it.

**A benchmark that was too easy.** The first sequence typed 60 characters at 45 ms
intervals, which is slower than real typing and left so much headroom that the two list
paths were almost indistinguishable. I made it heavier — 120 characters at 16 ms — and
recorded both results in the README. Worth saying plainly: I changed the benchmark because
45 ms is not how people type, not because the first number was inconvenient, and the first
number is published next to the second so anyone can judge that for themselves.

**Prose.** The first drafts of the README were longer, more even in tone, and hedged where
they should have been direct. I cut them substantially and rewrote the sections that
mattered, particularly the bug explanation and the honesty about what the performance
harness does not measure.

## What I am unsure about

**Whether the performance result supports the change.** It is measured and it is weak.
Average frame rate and p95 are identical between the two list paths; only the worst frame
and two dropped frames separate them. My argument for the optimisation rests on what the
tail would do on a throttled physical device, and I did not measure that. It is a
prediction. A reviewer would be right to push on it.

**Whether the JS-thread frame recorder is the right instrument.** It reports average FPS,
p95 and worst frame time and dropped frames, which is enough to compare two runs of the
same sequence on the same machine. It cannot see UI-thread stalls, and on a real device
that is often where the dropped frames are. It also could not read the Hermes heap in this
runtime, so that column says `n/a`. FlashList ships its own `JSFPSMonitor` and
`useBenchmark`; I did not cross-check against them, and I should have.

**Android is untested.** Nothing in the project needs native code, so I expect it to run,
but I have not run it. `KeyboardAvoidingView` is the part I would expect to need work.

**Backoff never gives up.** A recoverable failure retries forever with a 15-second cap.
A real client should stop after some number of attempts and tell the user, and I have not
decided what that number should be.

**Person-to-person services (Apple 3.1.3(d)).** I read it, I think asynchronous DMs fall
outside it, and I would not stake a scope decision on my reading without asking Apple.
