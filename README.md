# FanSuite chat — Senior React Native exercise

A fan-facing chat screen and subscription paywall in Expo, React Native and TypeScript.
Messages survive a dropped connection and a force quit without duplicating, paid access
is only granted when the backend confirms it, and the thread stays responsive over a
50,000 message history.

Everything runs against local mocks. There is no backend, no store account and no real
money anywhere in this project.

---

## Running it

```bash
npm install
npm start          # then press i for iOS
npm test           # 26 tests
npm run typecheck
```

Demo platform: **iOS Simulator, iPhone 16 Pro, iOS 26.0**, Expo Go, development
(non-minified) JS bundle unless stated otherwise.

Android should run from the same source — there is no native code in this project and no
library that requires a development build. `npm run android` is wired up, but **I did not
test Android**, so treat it as unverified. The one place I would expect a difference is
keyboard handling: `KeyboardAvoidingView` uses `padding` on iOS and nothing on Android,
which is the usual starting point and usually needs tuning against a real Android device.

Every failure case is driven from the **demo controls**, reachable from the `•••` button in
the chat header.

---

## The duplicate message bug

### What happens

`ChatTransport.send` writes the message to the server and then, when the demo control
**Drop responses** is on, throws `response-lost`. That is the shape of the real failure:
the request arrived, the server committed it, and the reply never came back. The client
cannot tell this apart from a request that never arrived.

So the client retries. With server-side deduplication removed, the second request is a
new message as far as the server is concerned, and the thread ends up with two copies —
visible as soon as the fan reopens the conversation and the history is loaded from the
server.

`src/features/chat/__tests__/duplicateOnLostResponse.test.ts` runs that exact flow twice:

| Test | Server holds | Client shows after reopening |
|---|---|---|
| `is stored twice when the server does not deduplicate on the client id` | 2 copies | 2 copies |
| `is stored once when the server deduplicates on the client id` | 1 copy | 1 copy |

The first test is the bug, pinned down. Both run the same client code — only the mock
server's `idempotency` option differs. Flip `idempotency` back to `false` in
`MockChatServer` and the second test fails; that is the test that fails before the fix
and passes after it.

### Why it happens

A retry is only safe if the server can recognise it. Nothing in the request identified
the *message* as opposed to the *attempt*, so two attempts looked like two messages.

### The fix

Three parts, none of which work alone.

**A stable client id, created once.** `Outbox.enqueue` generates a client id and writes
it to storage *before* anything touches the network. Retries reuse it, and a restart
reloads it. The id belongs to the message, not the attempt.

**Write-ahead persistence.** A message is persisted before it is treated as queued, so a
force quit between the tap and the network call cannot lose it. On load, anything left in
`sending` goes back to `queued`: the outcome of that attempt is unknown, and retrying is
safe precisely because the server deduplicates.

**Server-side deduplication on the client id.** `MockChatServer` keeps a map of accepted
client ids to message ids and returns the existing message when it sees one again. That
map is persisted in the server's own storage namespace, separate from the client's
outbox, so it survives a restart of either side independently.

### What I deliberately did *not* do

An earlier version also deduplicated by client id when merging confirmed messages into
the thread. It made the duplicate test pass while the server still held two copies — the
thread quietly disagreed with the server, and the disagreement would come back the moment
anyone paged through history. I removed it. Matching by client id now only does one job:
removing a queued message once its confirmation arrives, whether that confirmation comes
back from the retry or from a routine pull.

---

## Ordering

The thread is two ordered sections.

**Confirmed messages** are sorted by the sequence number the server assigned. The server
owns the order; the client never invents one. Merging is by sequence number into a map,
so pulling the same page repeatedly cannot duplicate or reorder anything —
`ordering.test.ts` merges the same page three times and asserts the result is unchanged.

**Queued messages** sit in a tail after them, in local creation order, and leave it only
when the server confirms them. That is why nothing jumps: a queued message never has a
provisional position among confirmed ones that it could later be moved out of.

A recoverable failure stops the queue and retries with backoff rather than skipping
ahead, so messages the user sent in order arrive in order. A fatal failure marks that one
message and lets the rest through — one rejected message should not block the
conversation.

---

## Failures the user can see

| Situation | Code | Recoverable | What the UI offers |
|---|---|---|---|
| Offline | `offline` | yes | "Waiting for connection", sends on reconnect |
| Server unavailable | `server-unavailable` | yes | Automatic retry with backoff, plus "Try again" |
| Response lost | `response-lost` | yes | Same, and the retry is deduplicated |
| Timeout | `timeout` | yes | Same |
| No subscription | `entitlement-required` | no | "Subscribe" — retrying cannot help |
| Message rejected | `message-rejected` | no | "Try again" is wrong here; the text is kept and the user is told to edit it |

Failed sends keep their text. Nothing is silently dropped, and nothing offers a retry that
cannot succeed.

---

## Payments and paid access

Purchases and access are two separate services on purpose.

`MockBillingService` stands in for the store: it owns products and receipts and can
succeed, be cancelled by the user, or fail. `MockEntitlementBackend` stands in for our own
server: it owns access and grants it only after it confirms a receipt.

The consequence is the state the brief asks for. A purchase that succeeds while
confirmation is outstanding shows **"Payment received, confirming access"** — the paywall
does not claim access it does not have. The chat composer stays locked until the backend
says yes. The demo controls can set confirmation to instant, 4 seconds or 20 seconds, and
confirm a pending receipt by hand.

- **Repeated taps**: one in-flight flag covers purchase and restore. Three concurrent
  purchase calls produce one receipt (`entitlement.test.ts`).
- **Replayed events**: submitting a receipt the backend already knows is a no-op, so
  restoring twice, or a confirmation arriving twice, changes nothing.
- **An unrelated failure**: a failed purchase only touches the purchase phase. Access that
  is still valid stays valid — asserted directly.

Everything in the paywall is labelled **Simulated billing**.

### Connecting this to real billing

The seam is already in the right place: swap `MockBillingService` for StoreKit 2 or Play
Billing, and `MockEntitlementBackend` for a real endpoint. Concretely:

1. **Client buys, client does not decide.** The client sends the transaction to our
   backend and waits. It never grants access from a local receipt — a jailbroken device
   can forge one.
2. **Server-side validation.** iOS: verify the signed `JWSTransaction` against Apple's
   root certificates, or call the App Store Server API. Android: `purchases.subscriptions.get`
   on the Play Developer API, then acknowledge within three days or Play refunds it
   automatically.
3. **The transaction id is the idempotency key**, exactly as the client id is for messages.
   The same receipt submitted twice must produce one entitlement. That is already true of
   the mock.
4. **Expiry and refunds come from the server, not the client.** App Store Server
   Notifications V2 (`DID_RENEW`, `EXPIRED`, `REFUND`, `GRACE_PERIOD_EXPIRED`) and Play
   Real-time Developer Notifications (`SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_EXPIRED`,
   `SUBSCRIPTION_REVOKED`). The client polls its entitlement and renders whatever it is
   told. `expireEntitlement()` in the demo controls is the local stand-in.
5. **Restore** re-submits known transactions and reconciles, rather than trusting the
   device's own history.

---

## Performance

### The history

`MockChatServer` does not store 50,000 rows. The history is a seeded generator: message
*n* is derived from a hash of `n`, so it is identical on every run and on every reset, and
reading a page costs only the page. Real sends are appended on top of it with sequence
numbers continuing from 50,000, and those are persisted. `mockChatServer.test.ts` asserts that
the same sequence number always produces the same message, and that paging reaches the
oldest one.

Paging is 40 messages at a time, backwards from the newest, triggered by the list
reaching its start.

### Measuring

Demo controls → **Run scroll and type benchmark** runs a fixed sequence: 40 scroll steps
through the content at 60 ms intervals, then 120 keystrokes into the composer at 16 ms.
Same history, same offsets, same timings every run, roughly 4.7 seconds and about 280
frames. `FrameRecorder` samples `requestAnimationFrame` and reports average FPS, median
and p95 frame time, the worst frame, and dropped frames (any interval over 25 ms).

**What this measures and what it does not.** These are JavaScript-thread frames. It cannot
see UI-thread or native rendering stalls, which on a real device are often where the
dropped frames actually are. Real numbers need Instruments (Time Profiler + Core
Animation) on a physical device. And simulator results are not evidence about a phone: the
simulator runs on the Mac's CPU with no thermal or memory pressure.

The heap column reads `n/a`: `HermesInternal.getInstrumentedStats()` is not exposed in
this runtime, so there is no JS heap number I can stand behind. Memory has to come from
Xcode's memory gauge or Instruments. I would rather print `n/a` than a number I cannot
source.

FlashList also ships its own `JSFPSMonitor` and `useBenchmark`. I did not cross-check
against them and I should have.

### The bottleneck, before and after

The composer draft used to live in the chat screen, the parent of the list. Every
keystroke re-rendered the screen, which re-created `renderItem`, which made FlashList
re-render every visible row. Typing a sentence into a 50,000 message thread re-rendered
the visible rows once per character.

The fix was to move the draft into its own store (`composerStore`) that only the composer
subscribes to, and to keep `renderItem`, `keyExtractor` and the row callbacks stable so
FlashList can recycle rows instead of rebuilding them.

Both paths are in the build. The **Unoptimised list** switch in the demo controls puts the
list back on inline row renderers with `extraData` bound to the draft, so the same
benchmark can be run against each.

Measured on the simulator, same history, same sequence, back to back:

| Run | Avg FPS | p95 frame | Worst frame | Dropped | Heap |
|---|---|---|---|---|---|
| Unoptimised list | 59.9 | 17.1 ms | 28.6 ms | 2 | n/a |
| Optimised list | 59.8 | 16.8 ms | 17.3 ms | 0 | n/a |

**Read this honestly: the averages are the same.** Both runs hold 60 fps, and p95 differs
by 0.3 ms, which is noise. The change shows up only in the tail — the worst frame drops
from 28.6 ms to 17.3 ms, and the two dropped frames become zero.

That is the expected shape, and it is worth saying why rather than dressing it up. Every
keystroke on the unoptimised path re-renders the visible rows. On a Mac's CPU that work
still fits inside a 16.7 ms budget almost every time, so the average cannot move — 60 fps
is the ceiling, and both runs are already at it. It only overruns when a keystroke lands
on a frame that was already busy, and then it overruns by roughly one whole frame.

Two dropped frames in 280 is not a user-visible problem on this hardware. The reason I
still made the change is that the tail is what degrades first on a real phone: the same
per-keystroke work on a mid-range Android under thermal throttling has several times less
headroom, and a 28 ms frame there becomes a 60 ms frame. **I did not measure that**, so it
is a prediction, not a result. A physical device and Instruments would settle it, and that
is the measurement I would want before claiming the optimisation matters.

The first version of this benchmark typed 60 characters at 45 ms and separated the two
paths even less — one dropped frame against zero. I made the sequence heavier because 45 ms
between keystrokes is slower than real typing and left too much headroom, not because the
first result was inconvenient. Both numbers are above.

---

## Design

Built from the FanSuite mobile `chat` frame: header with the creator and the
**Fan in All Access** badge, a `Today` separator, incoming messages indented behind the
creator's avatar, the fan's own messages flush to the container, timestamps under each
bubble, and a composer with a character count and the access line.

The offline, pending, failed and purchase states are not in the design, so I designed them
to disappear into it: status lives *inside* the bubble as a small caption with a dot,
rather than as separate chrome. A queued bubble is the normal bubble at 85% opacity. A
failed one swaps to the danger surface and grows an explanation and two actions. Nothing
shifts position when a message settles, because the queued tail and the confirmed section
are already in the right order.

The connection banner is the only new chrome, and only when there is something to say.

**Accessibility.** Every control has a role, a label and a state. Bubbles read as one
sentence with author, time, text and status rather than as four fragments. The connection
banner and the awaiting-confirmation card are live regions. Touch targets are at least
44 pt.

**Motion.** There is very little of it, and no decorative animation. Transitions are
native modal presentations and list scroll, both of which already respect the system
Reduce Motion setting.

---

## What I would do differently with more time

- **Measure on a physical device.** The simulator numbers below are real but weak, and the
  case for the list optimisation rests on a device measurement I have not taken.
- **A component test for the chat screen.** The tests cover the logic thoroughly and the
  screen not at all. Rendering it with `@testing-library/react-native` and asserting the
  queued, failed and locked states is the obvious next test.
- **Real storage for the outbox.** AsyncStorage rewrites the whole outbox array on every
  status change. That is fine for a queue of a few messages and wrong at a thousand.
  SQLite with a row per message is the real answer.
- **A proper backoff policy.** It is exponential with jitter, capped at 15 seconds, and it
  never gives up. It should give up eventually and say so.
- **Reconnect from real connectivity**, not a switch. `@react-native-community/netinfo`
  would drive the same `NetworkConditions` object.

---

## Resuming a large media upload

Split the upload into a session and its parts. Ask the backend for an upload session
keyed by a content hash of the file, persist that session id next to the local file path
before the first byte goes out, and upload in fixed-size chunks, recording each acked
chunk index. On resume, ask the server which chunks it already has and send only the rest.
The content hash means the same file is never uploaded twice, the same way a client id
means the same message is never stored twice.

**Backgrounding and force quitting are different problems.**

Backgrounding is survivable in-process. On iOS, `URLSession` with a background
configuration hands the transfer to the system, which continues it while the app is
suspended and relaunches the app to deliver the completion. On Android the equivalent is
`WorkManager` with a foreground service for a long upload. The app comes back to a
transfer that kept running.

A force quit or a force stop kills the process and, on Android, also cancels scheduled
work until the user next opens the app. Nothing continues. The only thing that survives is
what was written to disk before the kill — which is why the session id and the acked chunk
list have to be persisted as they are produced, not at the end. On relaunch, the upload
resumes from durable state. On iOS a force quit also tears down background sessions, so
the same rule applies there.

So: background transfers are an optimisation, and durable per-chunk state is the
correctness requirement. The design has to work with only the second.

---

## Store rules

See [`docs/store-policies.md`](docs/store-policies.md) for the App Store and Google Play
rules that apply to creator content and payments, with official links, and what they mean
for this app's scope.

---

## Time spent

Roughly seven hours, including reading the brief and the Figma file.

Approximate split: two hours on message correctness and the outbox, one hour on payments
and entitlements, two hours on the screens and the failure states, one hour on tests and
the two races the first test run exposed, one hour on this document and the store-policy
notes.

The part that did not fit is a physical device: everything here was measured on the
simulator, which is the weakest evidence the brief asks for.
