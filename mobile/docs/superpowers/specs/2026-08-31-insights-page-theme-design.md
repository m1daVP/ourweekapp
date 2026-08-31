# Insights Page Theme Pass

## Goal

Bring the `/insights` page into visual alignment with OurWeek's current calm, mobile-first theme without changing its insights data, search behavior, routing, or loading/error states.

## Approach

Refresh `InsightsPage.vue` using existing theme tokens and page patterns rather than adding a new design system or dependency. The page will retain its current structure and content, with targeted visual treatment for the header, period selector, overview cards, topic/source actions, search form, search result groups, and feedback states.

## UI Design

- Use an editorial, focused header that matches the app's display type and muted supporting copy.
- Make period controls feel like an intentional segmented selection with a clear active state and accessible focus/disabled treatment.
- Give overview cards a distinct hierarchy: muted label, readable primary metric, and soft metadata chips. Keep the grid single-column and touch-friendly.
- Style recurring-topic rows and search-result links as clearly tappable, contained list items with comfortable spacing.
- Make search input and action align cleanly on narrow screens, allowing the action to wrap or stack where needed.
- Use the existing surface, outline, typography, radius, shadow, and primary-color tokens throughout. No hard-coded palette or desktop-only layout.

## Behavior and Accessibility

- Preserve all existing loading, error, retry, search, pagination, navigation, and period-selection behavior.
- Preserve semantic buttons, headings, labels, and links.
- Maintain at least the project minimum touch-target size for controls and visible keyboard focus states.
- Keep all spacing safe-area compatible through the existing app shell.

## Validation

- Run the formatter for the touched Vue file.
- Run `npm run build` and `npm run check`.
- Manually inspect the page at a mobile viewport to confirm the information hierarchy, wrapping, and interactive states fit the app theme.
