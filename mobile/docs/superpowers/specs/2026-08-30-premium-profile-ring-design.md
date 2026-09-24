# Premium profile ring design

## Goal

Make an active Premium subscription visible in the app header with a continuous Google-color gradient ring around the profile avatar.

## Behaviour

- The header avatar shows a slim, continuous gradient in Google blue, red, yellow, and green when the trusted subscription store reports an active Premium entitlement.
- The avatar content is explicitly layered above the gradient so the gradient appears only as a border and never covers the initials or avatar colour.
- The gradient ring rotates linearly once every 36 seconds; the avatar itself stays still.
- Motion is disabled when the device requests reduced motion.
- Free users, users whose entitlement is unavailable, and users while entitlement status has not resolved keep the existing plain avatar.
- The avatar remains the existing link to Settings and its accessible label remains unchanged.

## Implementation

- `AppShell.vue` reads the existing subscription store and conditionally adds a Premium modifier class to the profile link.
- Global avatar styles create the ring with a CSS conic gradient only. The existing avatar size, initials, background colour, spacing, and touch target remain unchanged.
- No new strings, APIs, state, or dependencies are introduced.

## Verification

- Check the header with active Premium and Free entitlement states.
- Confirm the Settings link remains usable and keyboard focus remains visible.
- Run `npm run build` and `npm run check`.
