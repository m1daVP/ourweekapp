# AGENTS.md

## Project Overview

**Weekly Us** is a mobile-only application for guided 15-minute weekly check-ins for couples and families.

The app helps users reduce household chaos and avoid recurring conflicts by guiding them through a short structured meeting about:

- what went well this week;
- household tensions and unresolved problems;
- tasks and responsibilities;
- purchases and money;
- kids and family routines;
- upcoming plans;
- final agreements and follow-ups.

The product should feel like a calm practical tool, not a therapy app and not a corporate task tracker.

Core positioning:

> A guided 15-minute weekly meeting app for couples and families to reduce household chaos and make clear agreements.

## Tech Stack

Use the following stack unless explicitly changed:

- Vue 3
- TypeScript
- Vite
- Capacitor
- Android-first
- iOS-ready architecture, but do not configure iOS unless requested
- Pinia
- Vue Router
- ESLint
- Prettier

Package manager: npm

The app is mobile-only. Do not design desktop layouts unless explicitly requested.

## Product Principles

### 1. Keep it simple

The biggest product risk is making the app feel like Jira for families.

Avoid:

- complex dashboards;
- too many filters;
- heavy task management flows;
- corporate wording;
- unnecessary configuration;
- productivity-guru language.

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

1. Start weekly meeting.
2. Review last week.
3. Discuss key topics.
4. Create tasks and agreements.
5. Finish with a clear summary.
6. Review unfinished items next week.

Every feature should support this loop.

### 3. Do not turn it into a generic family organizer

Avoid adding features just because they are common in family apps.

Do not add unless requested:

- meal planner;
- grocery list;
- family chat;
- photo memories;
- bucket lists;
- complex calendar;
- full budgeting system;
- children’s profiles with complex tracking.

Weekly Us should focus on guided conversations, agreements, and follow-up.

## Current MVP Scope

The initial MVP should include:

- onboarding;
- participant setup;
- weekly meeting template;
- guided meeting flow;
- tasks;
- agreements;
- responsible person assignment;
- meeting history;
- local persistence;
- premium feature locks;
- simple mobile UI.

The MVP may use local state and localStorage before backend integration.

## Planned Paid Features

Premium features may include:

- AI meeting summaries;
- unlimited meeting history;
- reminders for unfinished agreements;
- additional meeting templates;
- private notes;
- Google Calendar sync;
- export to text, Markdown, or PDF;
- advanced statistics later.

Do not implement real payments until explicitly requested.

## Access Model

Prepare architecture for:

### Free plan

Free users can:

- create basic weekly meetings;
- use the default meeting template;
- create tasks and agreements;
- assign responsibility;
- view limited meeting history, for example last 3 finished meetings.

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

- Owner
- Adult member / Partner
- Viewer, optional later
- Child profile, optional later and not as a real login in MVP

Avoid complex enterprise RBAC.

## UX and Tone

The app should sound calm, practical, and neutral.

Use wording like:

- “What should we agree on?”
- “Who will take care of this?”
- “Still relevant?”
- “Review unfinished tasks”
- “What felt stressful this week?”
- “What should we revisit next week?”

Avoid wording like:

- “Who failed?”
- “Overdue”
- “Productivity score”
- “Performance”
- “You must”
- “Your partner didn’t do this”

Do not shame users. Do not decide who is right or wrong. Do not present the app as therapy.

## AI Feature Rules

AI summaries are premium and should be implemented only through a clean abstraction.

Important:

- Do not call OpenAI or any external AI provider directly from the mobile app.
- Real AI calls must go through a backend.
- Keep API keys out of the mobile app.
- Use a mock AI provider until backend exists.

AI summaries must be neutral, short, practical, non-judgmental, and focused on agreements, tasks, and next steps.

AI summaries must not:

- diagnose users;
- provide therapy;
- decide who is guilty;
- make psychological claims;
- escalate conflict;
- pretend to be professional advice.

Add disclaimer where needed:

> AI summaries may be inaccurate. Review before relying on them.

## Suggested Project Structure

Use this structure as the default direction:

```txt
src/
  app/
    App.vue
    router/
      index.ts
    stores/
      index.ts

  pages/
    HomePage.vue
    MeetingPage.vue
    MeetingDetailsPage.vue
    TasksPage.vue
    HistoryPage.vue
    SettingsPage.vue
    UpgradePage.vue

  features/
    meeting/
      components/
      composables/
      services/
      stores/
      types.ts

    tasks/
      components/
      composables/
      services/
      stores/
      types.ts

    agreements/
      components/
      composables/
      services/
      stores/
      types.ts

    participants/
      components/
      composables/
      stores/
      types.ts

    subscription/
      components/
      composables/
      services/
      stores/
      types.ts

    ai-summary/
      components/
      services/
      types.ts

    reminders/
      components/
      services/
      types.ts

    export/
      services/
      types.ts

  shared/
    components/
      AppShell.vue
      PageHeader.vue
      BottomNavigation.vue
      BaseButton.vue
      BaseCard.vue
      BaseInput.vue
      BaseTextarea.vue
      BaseModal.vue
      EmptyState.vue
      PremiumLock.vue
      UpgradePrompt.vue

    composables/
    constants/
    services/
    types/
    utils/

  assets/

  styles/
    main.css
    variables.css
```

Keep this structure flexible. Do not create empty folders unless they are useful for the current task.

## TypeScript Guidelines

Use TypeScript consistently.

Prefer explicit domain types for:

- Meeting
- MeetingSection
- MeetingNote
- MeetingTask
- Agreement
- Participant
- User
- PlanType
- FeatureKey
- UserRole
- MeetingTemplate
- PrivateNote

Avoid `any` unless there is a clear reason.

Use union types for controlled values:

```ts
type PlanType = 'free' | 'premium';

type TaskStatus = 'open' | 'done' | 'skipped';

type UserRole = 'owner' | 'adult_member' | 'viewer';
```

Keep types close to the feature when they are feature-specific. Move to `shared/types` only when reused across multiple features.

## State Management

Use Pinia for app state.

Recommended stores:

- `useMeetingStore`
- `useTaskStore`
- `useAgreementStore`
- `useParticipantStore`
- `useSubscriptionStore`
- `useSettingsStore`
- `useAuthStore` later

For MVP, persistence may use localStorage through a storage service abstraction.

Do not scatter direct localStorage calls across components.

Use a service like:

```ts
storageService.get();
storageService.set();
storageService.remove();
```

## Data Persistence

For MVP:

- use localStorage;
- add basic data versioning;
- prepare migrations;
- do not silently delete user data;
- handle corrupted data gracefully.

Later:

- backend sync should be introduced through API services;
- do not rewrite the whole app when backend is added;
- keep data access behind composables/services where practical.

## Routing Rules

Use Vue Router.

Main routes may include:

- `/`
- `/meeting`
- `/meeting/:id`
- `/tasks`
- `/history`
- `/settings`
- `/upgrade`
- `/private-notes`
- `/templates`

Premium routes should not break for free users. Show a lock screen or upgrade prompt instead.

Use route meta only if it keeps logic simple.

## Mobile UI Rules

The app is mobile-only.

Prioritize:

- safe-area support;
- large touch targets;
- one-handed usage;
- simple bottom navigation;
- clear page headers;
- short text;
- cards with clear hierarchy;
- minimal forms.

Avoid:

- dense tables;
- desktop sidebars;
- hover-only interactions;
- tiny icons without labels;
- too many nested screens.

Bottom navigation should likely include:

- Home
- Meeting
- Tasks
- History
- Settings

## Capacitor Rules

The app is Android-first.

Capacitor requirements:

- app name: `Weekly Us`
- app id placeholder: `com.weeklyus.app`
- Android platform should be configured
- iOS should be possible later but not configured unless requested
- web build output must match Capacitor config

Do not add native plugins unless needed. For browser development, native features must fail gracefully.

## Notifications

Use local notifications only when reminders are implemented.

Do not add Firebase Cloud Messaging or push notifications unless requested.

Reminder wording should be gentle.

Good:

> A gentle reminder to review unfinished agreements.

Bad:

> You have overdue family tasks.

## Payments and Subscriptions

Do not implement real payments unless explicitly requested.

For mobile subscriptions:

- prepare an abstraction first;
- do not hardcode billing logic in UI components;
- consider RevenueCat or direct Google Play Billing later;
- do not use only frontend state as the source of truth in production;
- use mock subscription provider in development.

Do not collect payment details manually. Do not implement Stripe Checkout for mobile app subscriptions unless platform rules are reviewed.

## Backend Integration

Do not add backend unless requested.

When preparing backend integration, use a clean API layer:

```txt
src/shared/api/
  httpClient.ts
  authApi.ts
  meetingsApi.ts
  tasksApi.ts
  subscriptionsApi.ts
  aiApi.ts
```

Backend-dependent features:

- authentication;
- family workspace sync;
- AI summaries;
- subscription validation;
- Google Calendar OAuth;
- cross-device sync.

Keep frontend ready for backend, but do not over-engineer too early.

## Google Calendar

Google Calendar sync is premium and should be treated carefully.

Do not implement OAuth casually inside the mobile app. Do not store Google tokens insecurely.

Prepare only:

- UI placeholder;
- calendar service abstraction;
- connection status;
- TODO notes for secure backend-supported OAuth.

## Export

Export is premium.

Supported formats may include:

- plain text;
- Markdown;
- simple PDF later.

Private notes must not be included by default. Export content should be clean and readable.

## Privacy and Safety

This app may contain sensitive family information.

Do not imply security that does not exist. If data is local-only, say so clearly.

For private notes, include:

> Private notes are stored on this device in the current MVP.

Do not claim encryption unless it is actually implemented.

## Code Style

Follow these rules:

- keep components small;
- keep feature logic out of large page components;
- use composables for reusable logic;
- use services for persistence, AI, export, notifications, subscriptions;
- avoid premature abstractions;
- avoid large utility files;
- avoid magic strings where union types or constants make sense;
- keep names clear and boring.

Prefer:

```ts
createMeeting();
finishMeeting();
addTask();
markTaskDone();
canUseFeature();
```

Avoid vague names:

```ts
handleStuff();
processData();
doAction();
manager();
```

The project formatting and linting configs are the source of truth:

- Prettier rules are defined in `.prettierrc.json`;
- Prettier ignored files are defined in `.prettierignore`;
- ESLint rules are defined in `eslint.config.js`.

After changing code, run:

npm run format
npm run lint:fix
npm run check

## Component Guidelines

Components should be focused, readable, mobile-friendly, and easy to test manually.

Do not create deeply nested component hierarchies unless necessary.

Common reusable components should go to `shared/components`. Feature-specific components should stay inside the feature folder.

## Error Handling

Show user-friendly errors.

Avoid technical messages in UI.

Good:

> Something went wrong while saving the meeting. Please try again.

Bad:

> localStorage JSON parse failed.

Log technical details only for development.

## Testing and Validation

Before finishing a task, check:

- app builds;
- TypeScript has no errors;
- lint passes if configured;
- main user flow still works;
- local data persists after refresh/restart;
- premium locks do not break free flow;
- mobile layout is not broken on narrow screens.

Useful commands:

```bash
npm run build
npm run lint
npm run format
npm run dev
npx cap sync android
npx cap open android
```

Only run commands that exist in the project. If a command is missing, add it only if appropriate.

## Git and Commit Rules

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

Do not commit unless explicitly requested.

Do not run destructive git commands unless explicitly requested.

Avoid:

```bash
git reset --hard
git clean -fd
git push --force
```

unless the user clearly asks for it and understands the consequence.

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
- make the UI desktop-first;
- add heavy UI frameworks without approval;
- overcomplicate the MVP.

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

## Definition of Done

A task is done when:

- the requested functionality works;
- the mobile UX is simple and usable;
- no obvious TypeScript/build errors remain;
- state is persisted if the feature needs persistence;
- locked premium behavior is handled if relevant;
- edge cases are not ignored;
- the implementation does not introduce unnecessary complexity;
- the result matches the product positioning of Weekly Us.
