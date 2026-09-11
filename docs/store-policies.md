# App Store and Google Play rules for creator content and payments

Checked September 2026. Both sets of rules change often, and the payments rules in
particular have been moving since 2024; anything below should be re-read against the live
policy before it drives a shipping decision.

---

## Apple — App Review Guidelines

<https://developer.apple.com/app-store/review/guidelines/>

### 3.1.1 In-App Purchase

> "If you want to unlock features or functionality within your app, (by way of example:
> subscriptions, in-game currencies, game levels, access to premium content, or unlocking
> a full version), you must use in-app purchase."

This is the rule this app lives under. An All Access subscription that unlocks messaging
and the media archive is premium content inside the app, so it is an IAP auto-renewable
subscription, with Apple's commission on it. Our own payment sheet is not an option.

### 3.1.1(a) Link to Other Purchase Methods

> "Developers may apply for entitlements to provide a link in their app to a website the
> developer owns or maintains responsibility for in order to purchase digital content or
> services. These entitlements are not required for developers to include buttons,
> external links, or other calls to action in their United States storefront apps."

The US storefront is now the exception rather than the rule, following the 2025 injunction
in *Epic v. Apple*. Elsewhere, linking out needs a StoreKit External Purchase Link
Entitlement, and outside the storefronts that allow it the app and its metadata may not
carry buttons or calls to action pointing at another purchasing mechanism. In practice
this means the paywall copy has to be storefront-aware: what is legal in the US build is a
rejection in most others.

### 3.1.3(b) Multiplatform Services

> "Apps that operate across multiple platforms may allow users to access content,
> subscriptions, or features they have acquired in your app on other platforms or your web
> site, including consumable items in multi-platform games, provided those items are also
> available as in-app purchases within the app."

A fan who subscribed on the web can use that subscription in the app. What the app cannot
do is send them to the web to subscribe. Our entitlement design already fits this: access
is a server-side fact the client reads, not something the client derives from a local
receipt, so a web subscription and an IAP subscription land in the same place.

### 3.1.3(d) Person-to-Person Services

> "If your app enables the purchase of real-time person-to-person services between two
> individuals (for example tutoring students, medical consultations, real estate tours, or
> fitness training), you may use purchase methods other than in-app purchase to collect
> those payments. One-to-few and one-to-many real-time services must use in-app purchase."

Worth knowing about and easy to over-read. A creator subscription is one-to-many and
firmly inside IAP. A genuinely one-to-one, real-time, scheduled paid session might qualify —
but asynchronous DMs, even one-to-one, are not a real-time service. I would not build a
scope decision on this without asking Apple first.

### 3.1.3(e) Goods and Services Outside of the App

> "If your app enables people to purchase physical goods or services that will be consumed
> outside of the app, you must use purchase methods other than in-app purchase."

Relevant if FanSuite ever sells merch: physical goods must *not* use IAP. A creator app
that sells both ends up with two payment paths, split by what is being bought.

### 1.2 User-Generated Content

> "To prevent abuse, apps with user-generated content or social networking services must
> include: A method for filtering objectionable material from being posted to the app; A
> mechanism to report offensive content and timely responses to concerns; The ability to
> block abusive users from the service; Published contact information so users can easily
> reach you."

Four hard requirements, and a creator DM product needs all four. This exercise has none of
them — it is a single mock conversation. A real build needs report, block and mute on the
thread and on each message, moderation before content is visible, and a response process
behind it.

### 1.1.4 Objectionable Content

> "Overtly sexual or pornographic material… This includes 'hookup' apps and other apps
> that may include pornography or be used to facilitate prostitution, or human trafficking
> and exploitation."

The rule that most shapes a fan-creator product's scope on iOS. Adult creator content
cannot ship in the App Store at all. Either the app enforces a content policy that the
web product does not, or the app carries only the safe-for-work tier and the rest stays on
the web — where, per 3.1.1(a), the app mostly cannot point.

---

## Google — Play Developer Program Policy

### Payments

<https://support.google.com/googleplay/android-developer/answer/10281818>

> "Google Play's billing system is required for developers offering in-app purchases of
> digital goods and services distributed on Google Play."

Same starting point as Apple: the subscription is a digital good, so Play Billing. The
listed exceptions — physical goods, physical services, utility and credit card payments,
peer-to-peer payments — do not cover a creator subscription.

Alternatives are regional and conditional: user-choice billing in India and South Korea at
a reduced service fee, billing alternatives and external offers in the EEA under the
Digital Markets Act, and alternative options in the US following the *Epic v. Google*
order. As with Apple, this is storefront-dependent behaviour, not a global switch.

Play-specific mechanics that matter more than they look:

- A purchase must be **acknowledged** within three days or Play refunds it automatically.
  Acknowledging belongs on the backend, after validation.
- **Real-time Developer Notifications** are the source of truth for renewal, expiry, hold,
  pause and revocation. A client that only reads its own purchase state will be wrong.

### User-generated content

<https://support.google.com/googleplay/android-developer/answer/9876937>

Play's UGC policy runs parallel to Apple's 1.2: apps hosting user-generated content need
in-app reporting and blocking, moderation appropriate to the risk, and a way for users to
reach the developer. The same gap applies to this exercise.

### Inappropriate content

<https://support.google.com/googleplay/android-developer/answer/9878810>

Sexually explicit content is not permitted on Play. Practically the same constraint as
Apple's 1.1.4, with the difference that Android can distribute outside Play — which makes
"Play build" versus "direct download build" a real product decision for an adult creator
platform, and one that changes billing too, since Play Billing only exists inside Play.

---

## What this means for the mobile app's scope

1. **The subscription is an IAP or Play Billing product.** Not our own payment sheet. The
   split between `MockBillingService` and `MockEntitlementBackend` in this project is built
   for exactly that swap.
2. **Validate on the server, always.** Both stores expect it, and both push the
   authoritative lifecycle to the server through notifications. Client-side receipt checks
   are forgeable.
3. **Steering copy is storefront-dependent.** The US build may point at the web; most
   others may not. That is a build-time or remote-config concern the paywall has to carry.
4. **Content rules shape the catalogue, not just the code.** If any creator tier is adult,
   it cannot be in either store, and the app cannot advertise a way to reach it. This is
   the constraint most likely to force a smaller mobile scope than the web product has.
5. **Report, block and moderation are ship blockers**, not backlog items. Both stores make
   them a condition of listing.
6. **Physical goods take a different path**, so a merch feature means a second payment
   integration rather than more IAP products.

---

## Sources

- [App Review Guidelines — Apple Developer](https://developer.apple.com/app-store/review/guidelines/)
- [Understanding Google Play's Payments policy — Play Console Help](https://support.google.com/googleplay/android-developer/answer/10281818)
- [An update regarding Google Play's policies for developers serving users in the US — Play Console Help](https://support.google.com/googleplay/android-developer/answer/15582165)
- [Offering an alternative billing system for users in the United States — Play Console Help](https://support.google.com/googleplay/android-developer/answer/16497028)
