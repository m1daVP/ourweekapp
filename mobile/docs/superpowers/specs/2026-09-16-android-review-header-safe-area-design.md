# Android Review Header Safe-Area Fix

## Problem

On the meeting review-and-finish step, the header does not reach the physical top of the Android screen while the page is scrolled. Scrolled page content remains visible behind the status-bar area. The issue is reproducible in the Android WebView but not in the desktop browser.

The meeting scroll container and the review header both reserve `env(safe-area-inset-top)`. Android WebView positions the sticky header below the scroll container's top padding, leaving the outer safe-area strip outside the header's opaque background.

## Design

The review-and-finish step will explicitly mark the surrounding meeting page as the final-review layout. For that layout only, the meeting scroll container will stop adding its own top safe-area padding. The existing sticky review header remains responsible for `env(safe-area-inset-top)`, so its background begins at the top of the viewport while its controls remain below the system status bar.

Other meeting steps keep the current scroll-container padding and layout. The bottom safe-area handling and fixed finish actions remain unchanged.

## Implementation Boundaries

- Add an explicit class to `MeetingPage.vue` while the final review section is active.
- Add a narrowly scoped rule in `src/styles/main.css` that removes only the top padding for that class while preserving horizontal and bottom padding.
- Keep `MeetingReviewCloseStep.vue`'s sticky positioning and internal safe-area padding unchanged.
- Do not convert the header to `position: fixed` or restructure the meeting flow.

## Verification

- Add or update a focused component test that asserts the final-review page class is present only for the review step.
- Run the relevant meeting test suite.
- Run `npm run build` and `npm run check`.
- On Android, scroll the review-and-finish page and confirm that no meeting content is visible in the status-bar area and that the header controls remain below the status bar.

## Risks

The change is isolated to the final review state. The main risk is selector mismatch that leaves the generic meeting padding active; the focused class test and build/check verification cover the code path, while final Android confirmation covers WebView rendering.
