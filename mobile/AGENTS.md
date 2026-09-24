## Project Identity

**OurWeek** is a mobile-only application for guided 15-minute weekly check-ins for couples and families.

The app helps a household review the week, talk through practical tensions, assign tasks, record agreements, and carry unfinished follow-ups into the next weekly meeting.

Core positioning:

> A guided 15-minute weekly meeting app for couples and families to reduce household chaos and make clear agreements.

The product should feel calm, practical, neutral, and useful. It must not feel like therapy software, a corporate task tracker, Jira for families, or a productivity scoring app.

## Current Tech Stack

Use this stack unless the user explicitly changes it:

- Vue 3
- TypeScript
- Vite
- Capacitor
- Android-first, iOS-ready architecture
- Pinia
- Vue Router
- vue-i18n
- ESLint
- Prettier
- npm

The app is **mobile-only**. Do not design desktop-first layouts unless explicitly requested.

Current important package versions from `package.json`:

- Vue `3.5.x`
- Pinia `3.x`
- Vue Router `5.x`
- vue-i18n `11.x`
- Capacitor `8.x`
- Vite `8.x`
- TypeScript `6.x`
- ESLint `10.x`
- Prettier `3.x`

Use npm only. Do not introduce yarn or pnpm unless the project is explicitly migrated.

## Existing npm Scripts

Use the existing scripts:

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run check
npm run cap:sync
npm run cap:open:android
```

Important details:

- `npm run dev` runs Vite with `--host 0.0.0.0`, useful for testing on a physical phone in the same network.
- `npm run build` runs `vue-tsc --noEmit && vite build`.
- `npm run check` runs `format:check` and `lint`.
- `npm run cap:sync` runs a production web build and then syncs Android.
- `npm run cap:open:android` opens the Android project.

Before finishing significant code changes, run:

```bash
npm run build
npm run check
```

When changing many files or formatting-sensitive code, also run:

```bash
npm run format
```

## Product Principles

### 1. Keep it simple

The biggest product risk is making the app feel like Jira, Notion, or a corporate dashboard for family life.

Avoid:

- complex dashboards;
- too many filters;
- heavy task management flows;
- corporate wording;
- unnecessary configuration;
- productivity-guru language;
- gamified blame or scoring.

Prefer:

- short flows;
- guided steps;
- calm wording;
- large buttons;
- clear next actions;
- minimal input fields;
- mobile-first interaction.

### 2. The app is a weekly ritual

The main user habit is:

1. Start a weekly meeting.
2. Review last week.
3. Discuss key topics.
4. Create tasks and agreements.
5. Finish with a clear summary.
6. Review unfinished items next week.

Every feature should support this loop.

### 3. Do not turn it into a generic family organizer

Do not add features just because they are common in family apps.

Do not add unless requested:

- meal planner;
- grocery list;
- family chat;
- photo memories;
- bucket lists;
- complex calendar;
- full budgeting system;
- children’s profiles with complex tracking;
- enterprise-style workspace management.

OurWeek should focus on guided conversations, agreements, tasks, and follow-up.

## Current Product / v1 Scope

The current product supports or is being prepared to support for public v1:

- guided weekly meeting flow;
- default and additional meeting templates;
- participant setup;
- notes, tasks, and agreements;
- responsible person assignment;
- meeting history;
- local persistence with basic data versioning;
- Free and Premium feature locks;
- RevenueCat-backed native Premium purchase and trusted backend validation;
- paid Premium purchase and entitlement validation behind trusted backend or store validation;
- backend AI summaries behind a Premium lock;
- private notes with a local-only storage notice;
- local reminders;
- export;
- Google Calendar sync UI/service preparation, with production OAuth/sync gated by backend support;
- Privacy Policy and Terms screens that must be replaced with reviewed legal documents before public release;
- Android Capacitor project prepared for release builds.

Public v1 intentionally avoids generic family-organizer features such as chat, meal planning, grocery lists, complex budgeting, or full calendar management.

## Current Project Structure

Respect the existing project structure:

```txt
src/
  app/
    router/
    stores/
    App.vue
  pages/
  features/
    access/
    auth/
    calendar/
    export/
    meeting/
    participants/
    private-notes/
    reminders/
    subscription/
    tasks/
    workspace/
  shared/
    api/
    components/
    composables/
    config/
    services/
  styles/
android/
docs/
```

Rules:

- Put app-level setup in `src/app`.
- Put route pages in `src/pages`.
- Put feature-specific logic inside `src/features/<feature-name>`.
- Put reusable UI/components/composables/services in `src/shared`.
- Put global styles and design tokens in `src/styles`.
- Do not create empty folders unless they are needed for the current task.
- Do not move the project to a different structure without explicit approval.

## Product Tone and Copywriting

OurWeek should sound calm, practical, neutral, and non-judgmental.

Use wording like:

- “What should we agree on?”
- “Who will take care of this?”
- “Still relevant?”
- “Review unfinished tasks”
- “What felt stressful this week?”
- “What should we revisit next week?”
- “A gentle reminder to review unfinished agreements.”

Avoid wording like:

- “Who failed?”
- “Overdue”
- “Productivity score”
- “Performance”
- “You must”
- “Your partner didn’t do this”
- “Fix your relationship”

Do not shame users. Do not decide who is right or wrong. Do not present the app as therapy or professional advice.

## Access Model

Free and Premium remain the product tiers. Paid Premium v1 requires trusted backend or store entitlement checks before unlocking paid features.

All app builds use trusted backend entitlement state. Shipped development mock Premium state is not supported.

### Free plan

Free users can:

- create basic weekly meetings;
- use the default meeting template;
- create tasks and agreements;
- assign responsibility;
- view limited meeting history, for example the last 3 finished meetings.

### Premium plan

Premium users can access:

- unlimited meeting history;
- AI summaries;
- reminders;
- extra templates;
- private notes;
- Google Calendar sync;
- export.

### Roles

Prepare simple role support for future family workspaces:

- Owner;
- Adult member / Partner;
- Viewer, optional later;
- Child profile, optional later and not as a real login in public v1.

Avoid complex enterprise RBAC.

## Vue 3 Rules

Use Vue 3 Composition API with `<script setup lang="ts">`.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';

const count = ref(0);
const doubledCount = computed(() => count.value * 2);
</script>
```

Rules:

- Use `<script setup lang="ts">` for Vue components.
- Keep components small and focused.
- Use typed props and emits.
- Move complex logic into composables or services.
- Do not put business logic directly in templates.
- Do not mutate props directly.
- Prefer computed values over unnecessary watchers.
- Use watchers only for side effects.
- Avoid direct DOM manipulation unless required for mobile/native behavior.
- Use semantic HTML: buttons should be `<button>`, not clickable `<div>`.

## TypeScript Rules

Use TypeScript consistently.

Prefer explicit domain types for:

- Meeting;
- MeetingSection;
- MeetingNote;
- MeetingTask;
- Agreement;
- Participant;
- User;
- PlanType;
- FeatureKey;
- UserRole;
- MeetingTemplate;
- PrivateNote.

Use union types for controlled values:

```ts
type PlanType = 'free' | 'premium';
type TaskStatus = 'open' | 'done' | 'skipped';
type UserRole = 'owner' | 'adult_member' | 'viewer';
type LoadingState = 'idle' | 'loading' | 'success' | 'error';
```

Rules:

- Avoid `any` unless there is a clear reason.
- Prefer `unknown` over `any` for unknown external values.
- Keep feature-specific types inside the related feature.
- Move types to `shared/types` only when reused across multiple features.
- Avoid magic strings where union types or constants make sense.

## Pinia Rules

Use Pinia for shared application state, not for every small local UI state.

Good Pinia use cases:

- current meeting/session;
- participants;
- tasks and agreements shared between screens;
- subscription/access state;
- settings;
- local persisted app state;
- auth later.

Bad Pinia use cases:

- one button loading state;
- one component modal visibility;
- temporary form input state that does not need to survive navigation.

Recommended stores:

- `useMeetingStore`
- `useTaskStore`
- `useAgreementStore`
- `useParticipantStore`
- `useSubscriptionStore`
- `useSettingsStore`
- `useAuthStore` later

Rules:

- Keep stores focused.
- Avoid huge global stores.
- Use setup-style stores.
- Use actions for state changes with logic.
- Keep API/native/persistence details behind services when practical.
- Do not scatter direct localStorage or plugin calls inside stores and components.

## Vue Router Rules

Use Vue Router for app navigation.

Expected main route areas may include:

- `/`
- `/meeting`
- `/meeting/:id`
- `/tasks`
- `/history`
- `/settings`
- `/upgrade`
- `/private-notes`
- `/templates`

Rules:

- Use named routes for programmatic navigation.
- Lazy-load route components where practical.
- Keep route definitions clean.
- Use route meta only when it keeps logic simple.
- Do not put heavy business logic into route guards.
- Unknown routes should show a safe fallback.
- Premium routes should not break for free users; show a lock screen or upgrade prompt.

## vue-i18n Rules

The project uses `vue-i18n`. Keep user-facing strings translation-ready.

Rules:

- Do not hardcode repeated user-facing strings across components.
- Use i18n keys for stable UI copy where the project already uses i18n.
- Keep keys clear and grouped by feature.
- Avoid overly abstract keys like `button.ok1` or `text.message2`.
- Keep copy calm and product-aligned.
- Do not use i18n for purely internal constants or developer-only logs.

Good key style:

```txt
meeting.start.title
meeting.summary.reviewWarning
tasks.empty.title
subscription.lock.aiSummary
```

## Vite and Environment Rules

Vite environment variables must use the `VITE_` prefix.

Current environment variables:

```txt
VITE_API_BASE_URL=
```

Rules:

- Never put secrets in Vite environment variables.
- Never place AI provider API keys in the mobile app.
- The API base URL is required for development, staging, and production.
- Keep Vite config simple.
- Use path aliases if already configured; do not introduce alias churn without benefit.

## Capacitor Rules

Treat Capacitor as a bridge between the Vue app and native platforms.

Current Android configuration from README:

- App name: `OurWeek`
- App id: `com.ourweek.app`
- Web output directory: `dist`

Rules:

- Android is the first target.
- Keep the architecture iOS-ready, but do not configure iOS unless requested.
- Keep native plugin usage inside services or composables.
- Do not call Capacitor plugins directly from many components.
- Always handle platform differences.
- Always handle permission denial.
- Always handle plugin errors.
- Native features must fail gracefully in browser development.
- Test important flows on a real Android device, not only in the browser.

Useful platform helper pattern:

```ts
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => Capacitor.isNativePlatform();
export const isAndroid = () => Capacitor.getPlatform() === 'android';
export const isIOS = () => Capacitor.getPlatform() === 'ios';
```

## Android-first, iOS-ready Rules

Android-first:

- Respect Android hardware/gesture back behavior.
- Test splash screen and app icon on Android.
- Test keyboard behavior on a real Android device.
- Avoid placing important actions too close to the bottom system navigation area.
- Avoid layouts that break with Android gesture navigation.

IOS-ready:

- Respect safe areas using `env(safe-area-inset-*)`.
- Avoid Android-only assumptions in business logic.
- Use platform checks where needed.
- Keep native configuration clean and isolated.

Use dynamic viewport units where appropriate:

```css
.app-shell {
  min-height: 100dvh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

## Android Back Button Priority

Android back behavior must be predictable.

When the Android back button is pressed, use this priority:

1. Close active popup/popover.
2. Close active bottom sheet.
3. Close active modal/dialog.
4. Close drawer.
5. Go back in router history.
6. Exit app only from a root screen.

Do not let Android back immediately exit the app while a drawer, modal, bottom sheet, popup, or nested flow is open.

## Mobile UI Rules

The app is mobile-only.

Prioritize:

- safe-area support;
- large touch targets;
- one-handed usage where practical;
- simple bottom navigation;
- clear page headers;
- short text;
- cards with clear hierarchy;
- minimal forms;
- visible feedback for taps, loading, disabled states, and errors.

Avoid:

- dense tables;
- desktop sidebars;
- hover-only interactions;
- tiny icons without labels;
- too many nested screens;
- gesture-only controls.

Recommended minimum tap target:

```txt
44x44 px minimum
48x48 px preferred for Android
```

Bottom navigation should likely include:

- Home;
- Meeting;
- Tasks;
- History;
- Settings.

## Drawer Rules

Drawers must behave like mobile drawers, not desktop sidebars.

Rules:

- A drawer should slide from the left or right edge.
- A drawer must have a backdrop.
- Tapping the backdrop should close the drawer.
- Android back should close the drawer before route navigation.
- Only one drawer should be open at a time.
- The body behind the drawer should not scroll.
- The drawer should trap focus while open.
- Restore focus to the trigger after closing.
- Avoid complex forms inside drawers.
- Avoid using a drawer for critical primary actions.
- Do not make drawer access gesture-only; provide a visible button.

## Modal and Dialog Rules

Use modals for focused, temporary tasks that require attention.

Rules:

- A modal must have a clear title.
- A modal must have a clear close or cancel action.
- A modal must not be used for main app navigation.
- Tapping the backdrop may close non-critical modals.
- Android back should close the topmost modal first.
- The content behind the modal should not scroll.
- The modal should trap focus.
- Restore focus after closing.
- Avoid stacking multiple modals.
- Avoid long forms inside small modals.
- On small screens, large modals should become bottom sheets or full-screen dialogs.

For destructive confirmations, use clear labels.

Good:

```txt
Delete meeting?
This action cannot be undone.

Cancel | Delete
```

Bad:

```txt
Are you sure?

No | Yes
```

## Bottom Sheet Rules

Bottom sheets are often better than centered modals on mobile.

Use them for:

- action menus;
- filters;
- sorting;
- small forms;
- contextual options.

Rules:

- Allow swipe down to close when safe.
- Show a visible drag handle if swipe is supported.
- Android back should close the sheet first.
- Do not hide critical actions below the fold.
- Avoid nested scroll conflicts.
- Make sure the sheet works with the keyboard open.

## Popup and Popover Rules

Popups and popovers are fragile on mobile. Use them carefully.

Rules:

- Do not rely on hover.
- Trigger by tap.
- Close when tapping outside.
- Android back should close the popup first.
- Avoid tiny popup menus near screen edges.
- Ensure popup content does not overflow the viewport.
- Prefer bottom sheets for complex mobile popups.
- Only one popup should be open at a time.

Good uses:

- small contextual menu;
- short help;
- simple overflow menu.

Bad uses:

- long explanations;
- complex forms;
- multi-step interactions;
- critical confirmations.

## Toast and Snackbar Rules

Use toasts/snackbars for lightweight feedback.

Rules:

- Use toasts for non-critical feedback.
- Do not use toasts for important errors that require action.
- Keep messages short.
- Do not stack many toasts.
- For destructive actions, prefer snackbar with undo.

Good:

```txt
Task deleted — Undo
```

## Forms on Mobile

Rules:

- Keep forms short.
- Use proper input types.
- Use labels, not only placeholders.
- Show validation errors near the field.
- Do not validate aggressively while the user is still typing.
- Avoid tiny checkboxes.
- Make the whole label row tappable for checkbox/radio inputs.
- Handle keyboard overlap.
- Scroll focused fields into view if needed.
- Do not assume browser keyboard behavior equals native WebView behavior.

Examples:

```html
<input type="email" autocomplete="email" />
<input type="tel" autocomplete="tel" />
<input type="text" autocomplete="name" />
```

## Weekly Meeting UX Rules

The core meeting flow should feel guided, not like filling a database.

Rules:

- Show one clear step or decision at a time.
- Keep text short and human.
- Make progress visible.
- Allow users to skip non-critical questions.
- Make it easy to add a task or agreement from discussion.
- Do not force users to categorize everything.
- At the end, show a clear summary of agreements, tasks, and follow-ups.
- Next week, unfinished items should be easy to review.

Avoid:

- heavy forms;
- long settings before a meeting can start;
- analytics during the meeting;
- blame-oriented summaries;
- productivity scores.

## Tasks and Agreements Rules

Tasks and agreements are related but not identical.

A task is something someone should do.

Example:

```txt
Buy new kindergarten shoes — Rita
```

An agreement is a shared decision or rule.

Example:

```txt
We will prepare kindergarten clothes in the evening.
```

Rules:

- Keep task creation quick.
- Responsibility should be clear.
- Avoid harsh labels like “overdue”.
- Prefer gentle follow-up wording like “Still relevant?” or “Review unfinished tasks”.
- Do not create complex project-management behavior unless requested.

## Private Notes Rules

Private notes are sensitive.

Rules:

- Make local-only behavior clear.
- Do not include private notes in export by default.
- Do not include private notes in AI summaries unless explicitly designed and approved.
- Do not imply encryption unless it is implemented.

Use this notice where appropriate:

> Private notes are stored on this device unless a reviewed sync design is implemented.

## Local Persistence Rules

The current product stores app data locally on the device through a shared storage service unless a feature is explicitly connected to backend sync.

Storage is split by sensitivity:

- Sensitive auth tokens, including access tokens and refresh tokens, must use `src/shared/services/authTokenStorageService.ts`, backed by `@aparajita/capacitor-secure-storage` on native platforms.
- Non-sensitive app settings should use `@capacitor/preferences` through the shared storage service. Preferences are suitable for lightweight settings such as localization, reminder settings, calendar sync preferences without OAuth tokens, and workspace UI/member settings.
- Meeting data, tasks, agreements, participants, and private notes remain in the versioned local app data store for offline/local-first behavior until a more specific persistence layer is introduced.
- Do not store access tokens, refresh tokens, OAuth tokens, API keys, payment data, or other secrets in `localStorage`, Capacitor Preferences, Pinia persistence, exports, logs, or user-visible error messages.
- Capacitor Preferences is not secure storage. Use it only for non-sensitive settings.

Stored data may include:

- meetings;
- tasks;
- agreements;
- participants;
- settings;
- private notes;
- onboarding state;

Rules:

- Do not scatter direct `localStorage` calls across components.
- Use a shared storage service abstraction.
- Add basic data versioning.
- Prepare migrations when storage shape changes.
- Do not silently delete user data.
- Handle corrupted data gracefully.
- If data is local-only, say so clearly.
- Do not claim cloud sync or encryption unless implemented.

Suggested service style:

```ts
storageService.get();
storageService.set();
storageService.remove();
```

## Premium and Subscription Rules

Native Premium purchases use RevenueCat and trusted backend entitlement validation.

Rules:

- Do not collect payment details manually.
- Do not hardcode billing logic in UI components.
- Keep subscription logic behind a provider/service abstraction.
- Production paid Premium requires trusted backend or store entitlement validation before paid features are unlocked.
- In production, frontend state must not be the source of truth for paid access.
- Shipped mock Premium providers or frontend-only entitlement overrides are not allowed.
- Purchase, restore, and manage-subscription flows must fail safely if entitlement validation is unavailable.
- Consider RevenueCat or direct Google Play Billing only after platform rules are reviewed.
- Do not use Stripe Checkout for mobile app subscriptions unless store policy implications are reviewed.

## AI Summary Rules

AI summaries are Premium-gated and always require a backend provider.

Rules:

- Do not call OpenAI or any external AI provider directly from the mobile app.
- Real AI calls must go through a backend.
- API keys must not be placed in the mobile app.
- Keep AI behind a clean provider/service abstraction.
- Shipped local or placeholder AI summary providers are not allowed.
- AI summaries must be neutral, short, practical, and non-judgmental.
- AI summaries should focus on agreements, tasks, and next steps.

AI summaries must not:

- diagnose users;
- provide therapy;
- decide who is guilty;
- make psychological claims;
- escalate conflict;
- pretend to be professional advice.

Use this disclaimer where needed:

> AI summaries may be inaccurate. Review before relying on them.

## Reminders and Local Notifications

The project includes Capacitor Local Notifications.

Rules:

- Use local notifications only for reminder features.
- Ask notification permission at the right moment, not on first launch.
- Explain why permission is needed before requesting it.
- Handle denied permissions gracefully.
- Do not repeatedly request denied permissions.
- Reminders should be useful and gentle, not spammy.
- Allow users to disable reminders.
- Handle notification taps correctly.

Good wording:

```txt
A gentle reminder to review unfinished agreements.
```

Bad wording:

```txt
You have overdue family tasks.
```

## Calendar Feature Rules

Google Calendar sync is Premium and should be treated carefully.

Rules:

- Do not implement OAuth casually inside the mobile app.
- Do not store Google tokens insecurely.
- Prefer backend-supported OAuth for production.
- Prepare only UI draft states, service abstraction, connection status, and TODO notes unless implementation is explicitly requested.

## Export Feature Rules

Export is Premium.

Supported formats may include:

- plain text;
- Markdown;
- simple PDF later.

Rules:

- Export content should be clean and readable.
- Private notes must not be included by default.
- Do not add heavy PDF dependencies without approval.
- Prefer simple Markdown/text export first.

## API Layer Rules

Backend API access is available behind `src/shared/api`. Use it only for features that are explicitly backend-backed.

Rules:

- Keep backend integration behind `src/shared/api` and feature services.
- Keep meeting, task, agreement, participant, and private-note data local-first unless sync is explicitly implemented.
- Do not rewrite the app around backend assumptions too early.
- Auth, subscription validation, AI summaries, Google Calendar OAuth, workspace sync, and future cross-device sync must stay behind services/API modules.
- Do not claim cloud sync or backend-backed behavior unless the feature is actually connected and tested.

Current API structure:

```txt
src/shared/api/
  httpClient.ts
  authApi.ts
  meetingsApi.ts
  tasksApi.ts
  subscriptionsApi.ts
  aiApi.ts
```

## Security and Privacy Rules

This app may contain sensitive family information.

Rules:

- Never store secrets in frontend code.
- Never commit `.env` files with real values.
- Do not claim cloud sync unless implemented.
- Do not claim encryption unless implemented.
- Validate data on the backend when backend exists.
- Avoid `v-html` unless absolutely necessary.
- If `v-html` is used, document why and sanitize the content.
- Do not expose raw technical errors to users.
- Placeholder Privacy Policy and Terms must be replaced before production release.

## Error Handling Rules

Show user-friendly errors.

Good:

```txt
Something went wrong while saving the meeting. Please try again.
```

Bad:

```txt
localStorage JSON parse failed.
```

Rules:

- Log technical details only for development/debugging.
- Do not silently ignore failed operations.
- Always provide a recovery path when possible.
- For network errors, allow retry.
- For validation errors, show the message near the field.

## Loading, Empty, and Error States

Every async or list-based screen should handle:

- loading state;
- empty state;
- error state;
- retry where relevant.

Empty state should include:

- short explanation;
- optional icon/illustration;
- primary action if relevant.

Example:

```txt
No meetings yet
Create your first weekly meeting to get started.

[Create meeting]
```

## Accessibility Rules

Rules:

- Interactive elements must be reachable by focus.
- Use semantic HTML where possible.
- Buttons should be `<button>`, not clickable `<div>`.
- Images need meaningful `alt` text unless decorative.
- Modals and drawers should manage focus.
- Color should not be the only way to communicate state.
- Text contrast must be sufficient.
- Avoid very small font sizes.
- Keep tap targets large enough for touch.

## Styling Rules

Rules:

- Use a consistent spacing scale.
- Prefer CSS variables for font-size, colors, spacing, radius, and shadows.
- Keep global styles minimal.
- Component styles should be scoped when appropriate.
- Avoid deep selectors unless necessary.
- Avoid inline styles except for dynamic values.
- Respect safe areas and dynamic viewport height.
- Use `rem` for font sizes, `px` for borders, icons, tiny fixed UI details and `em` only for component-relative spacing when needed.

Example tokens:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
}
```

## Performance Rules

Rules:

- Keep initial bundle size small.
- Lazy-load routes where practical.
- Avoid unnecessary global dependencies.
- Avoid heavy animations.
- Avoid large unoptimized images.
- Use SVGs for simple icons.
- Avoid unnecessary re-renders.
- Use `computed` instead of recalculating expensive values in templates.
- Do not keep large unused data in Pinia stores.
- For long lists, use pagination or virtualization.
- Use stable keys; avoid array index keys for dynamic lists.

## Animation Rules

Rules:

- Animations should be short and purposeful.
- Avoid slow decorative animations.
- Use transform and opacity where possible.
- Avoid animating layout-heavy properties like width, height, top, and left.
- Respect reduced-motion preferences.

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Dependency Policy

Before adding a dependency, ask:

1. Is this really needed?
2. Can Vue, Capacitor, or browser APIs solve this?
3. Is the package actively maintained?
4. Is the package size acceptable?
5. Does it work well inside Capacitor WebView?
6. Does it support mobile/touch behavior properly?
7. Does it create iOS problems later?

Avoid dependencies that:

- are unmaintained;
- are desktop-first only;
- add large bundle size for small features;
- require complex native setup without strong benefit;
- duplicate existing Vue/Capacitor/browser functionality.

## Android Release Testing Rules

This project is being prepared for a public Android v1 release with paid Premium.

Do not publish a public paid release until public release gates are resolved.

Before Android release testing:

- Run `npm run build`.
- Run `npm run check`.
- Run `npm run cap:sync`.
- Open with `npm run cap:open:android`.
- Create and verify a signed release build or AAB.
- Prepare Play Console app setup, internal/closed testing track, and release notes.
- Confirm Google Play Data Safety answers against final app behavior.
- Test on real Android devices.
- Check app restart behavior.
- Check offline behavior.
- Check local storage persistence.
- Check keyboard behavior.
- Check Android back behavior.
- Check splash screen and launcher icon.
- Check layouts on small and large Android screens.
- Check subscription purchase, restore, manage-subscription, and entitlement refresh flows before selling Premium.
- Check backend AI summary behavior before offering production AI summaries.

Release readiness notes are tracked in:

```txt
docs/android-mvp-release-readiness.md
```

## Public Release Gates

Do not treat the app as ready for public paid release until these are resolved:

- Replace draft Privacy Policy and Terms with reviewed legal documents.
- Replace temporary launcher icon and splash assets with production artwork.
- Configure Android Studio, JDK, signing, and Play Console release setup.
- Produce and verify a signed release build or AAB.
- Run real-device Android QA for restart, offline use, storage, and layout.
- Connect real subscription purchase, restore, management, and entitlement validation before selling Premium.
- Add backend-supported AI summaries before offering production AI features.
- Confirm Google Play Data Safety answers against final app behavior.

## Code Style

Follow the project ESLint and Prettier configs.

Rules:

- Keep components small.
- Keep feature logic out of large page components.
- Use composables for reusable logic.
- Use services for persistence, AI, export, notifications, subscriptions, and native plugins.
- Avoid premature abstractions.
- Avoid large utility files.
- Avoid vague names.
- Prefer clear, boring names.

Prefer:

```ts
createMeeting();
finishMeeting();
addTask();
markTaskDone();
canUseFeature();
```

Avoid:

```ts
handleStuff();
processData();
doAction();
manager();
```

## Component Guidelines

Components should be focused, readable, mobile-friendly, and easy to test manually.

Rules:

- Reusable components go to `src/shared/components`.
- Feature-specific components stay inside the feature folder.
- Components should support disabled/loading states where relevant.
- Components should not directly depend on unrelated feature business logic.
- Do not create deeply nested component hierarchies unless necessary.
- Do not create huge page components with hidden business logic.

## State Ownership Rules

Use the smallest reasonable state scope:

```txt
Local component state → UI-only state
Composable state → reusable local logic
Feature Pinia store → shared feature state
Global Pinia store → truly app-wide state
Persistent storage → state needed after app restart
Backend later → source of truth for server data
```

Do not put everything into Pinia by default.

## Git and Commit Rules

Do not commit unless explicitly requested.

Use clear Conventional Commit messages when asked to commit.

Examples:

```txt
feat(meeting): add guided weekly meeting flow
feat(tasks): add task responsibility assignment
feat(subscription): add premium feature locks
fix(storage): handle corrupted local data safely
refactor(meeting): extract meeting step components
chore(capacitor): configure android platform
```

Do not run destructive git commands unless explicitly requested.

Avoid:

```bash
git reset --hard
git clean -fd
git push --force
```

unless the user clearly asks for it and understands the consequence.

## Development Priority

Recommended order:

1. Base project setup
2. Mobile app shell
3. Onboarding
4. Participants
5. Core meeting flow
6. Tasks and agreements
7. Meeting history
8. Local persistence hardening
9. Feature access model
10. Premium locks
11. Meeting templates
12. Private notes
13. Export
14. Reminders
15. Auth
16. Backend sync
17. AI summary via backend
18. Payments/subscriptions
19. Google Calendar sync
20. Android release readiness

Do not follow this order blindly if the user asks for a specific task.

## Code Review Checklist

Before submitting changes, verify:

- Code is typed.
- No unnecessary `any`.
- No unused imports.
- No accidental console logs, except intentional error/debug logs.
- Components are not too large.
- Business logic is not hidden inside templates.
- Mobile layout works on narrow screens.
- Android back behavior is correct for overlays and navigation.
- Drawer/modal/popup behavior is predictable.
- Loading, empty, and error states exist where relevant.
- Accessibility basics are respected.
- Premium locks do not break the free flow.
- Local data persists after refresh/restart where expected.
- The implementation does not introduce unnecessary dependencies.
- The result matches OurWeek product positioning.

## What Not To Do

Do not:

- turn the app into Jira;
- add unnecessary enterprise RBAC;
- add chat;
- add meal planning;
- add grocery lists;
- add complex budgeting;
- add real payments too early;
- call AI APIs directly from the mobile app;
- store secrets in frontend code;
- implement OAuth insecurely;
- claim data is encrypted if it is not;
- claim cloud sync if it is not implemented;
- make the UI desktop-first;
- add heavy UI frameworks without approval;
- overcomplicate public v1;
- ignore Android back button behavior;
- rely only on browser testing for native behavior.

## Definition of Done

A task is done when:

- the requested functionality works;
- the mobile UX is simple and usable;
- no obvious TypeScript/build errors remain;
- `npm run build` passes for significant changes;
- `npm run check` passes for significant changes;
- state is persisted if the feature needs persistence;
- locked Premium behavior is handled if relevant;
- loading, empty, and error states are handled where relevant;
- Android back behavior is handled for overlays/navigation;
- edge cases are not ignored;
- the implementation does not introduce unnecessary complexity;
- the result matches the product positioning of OurWeek;
- the solution does not block future iOS support.
