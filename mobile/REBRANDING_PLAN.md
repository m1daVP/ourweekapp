# Rebranding Plan: Weekly Us → OurWeek

## Overview

This document outlines all code, configuration, and asset changes required to rebrand the app from **Weekly Us** to **OurWeek**.

**Scope**: 16 files + 1 folder restructure across 6 implementation phases.

**Storage Strategy**: Fresh start (new storage keys, no user data migration from MVP).

**Android Package**: `com.weeklyus.app` → `com.ourweek.app`

---

## Discovery Summary

### Configuration Files

- `capacitor.config.ts` — appId and appName
- `package.json` — npm package name
- `index.html` — page title
- `android/app/build.gradle` — namespace and applicationId
- `android/app/src/main/AndroidManifest.xml` — references app_name string
- `android/app/src/main/res/values/strings.xml` — package_name and custom_url_scheme

### Source Code (Hardcoded Strings)

- `src/shared/services/storageService.ts` — storage key prefixes (8 storage keys with "weekly-us")
- `src/shared/services/authTokenStorageService.ts` — AUTH_TOKEN_STORAGE_PREFIX
- `src/features/reminders/reminderService.ts` — ANDROID_CHANNEL_ID
- `src/features/export/services/exportService.ts` — export filename prefix
- `src/app/stores/auth.ts` — i18n reference for weeklyUsUser

### Localization/i18n (User-Facing)

- `src/features/localization/messages.ts` — app name, home title, welcome text, user display name

### Documentation

- `AGENTS.md` — app identity description
- `README.md` — project identity, setup instructions
- `DESIGN.md` — design system name
- `docs/android-mvp-release-readiness.md` — release notes and app references

### Android Java

- `android/app/src/main/java/com/weeklyus/app/MainActivity.java` — package declaration

### Assets

- App icons and launcher icons (in `android/app/src/main/res/mipmap-*`)
- Splash screen assets
- Landing page content (if applicable)

---

## Implementation Plan

### Phase 1: Core App Configuration (5 files)

Update app-level config that affects Capacitor, Android, and bundling.

**Files to modify:**

1. `capacitor.config.ts` (lines 6–7)
   - Change: `appId: 'com.weeklyus.app'` → `appId: 'com.ourweek.app'`
   - Change: `appName: 'Weekly Us'` → `appName: 'OurWeek'`

2. `package.json` (line 2)
   - Change: `"name": "weekly-us"` → `"name": "ourweek"`

3. `index.html` (line 10)
   - Change: `<title>Weekly Us</title>` → `<title>OurWeek</title>`

4. `android/app/build.gradle` (lines 4, 7)
   - Change: `namespace = "com.weeklyus.app"` → `namespace = "com.ourweek.app"`
   - Change: `applicationId "com.weeklyus.app"` → `applicationId "com.ourweek.app"`

5. `android/app/src/main/res/values/strings.xml` (lines 5–6)
   - Change: `<string name="package_name">com.weeklyus.app</string>` → `<string name="package_name">com.ourweek.app</string>`
   - Change: `<string name="custom_url_scheme">com.weeklyus.app</string>` → `<string name="custom_url_scheme">com.ourweek.app</string>`

---

### Phase 2: Storage Key Prefixes (5 files)

Update all storage keys from `weekly-us:*` to `ourweek:*`.

**Files to modify:**

1. `src/shared/services/storageService.ts` (lines 7–20)
   - Update all storage key constants:
     - `'weekly-us:app-data'` → `'ourweek:app-data'`
     - `'weekly-us:app-data:backup'` → `'ourweek:app-data:backup'`
     - `'weekly-us:settings'` → `'ourweek:settings'`
     - `'weekly-us:auth'` → `'ourweek:auth'`
     - `'weekly-us:calendar-sync-settings'` → `'ourweek:calendar-sync-settings'`
     - `'weekly-us:meetings'` → `'ourweek:meetings'`
     - `'weekly-us:participants'` → `'ourweek:participants'`
     - `'weekly-us:private-notes'` → `'ourweek:private-notes'`
     - `'weekly-us:reminder-settings'` → `'ourweek:reminder-settings'`
     - `'weekly-us:subscription:mock'` → `'ourweek:subscription:mock'`
     - `'weekly-us:tasks-agreements'` → `'ourweek:tasks-agreements'`
     - `'weekly-us:workspace'` → `'ourweek:workspace'`

2. `src/shared/services/authTokenStorageService.ts` (line 6)
   - Change: `const AUTH_TOKEN_STORAGE_PREFIX = 'weekly-us:auth:';` → `const AUTH_TOKEN_STORAGE_PREFIX = 'ourweek:auth:';`

3. `src/features/reminders/reminderService.ts` (line 21)
   - Change: `const ANDROID_CHANNEL_ID = 'weekly-us-reminders';` → `const ANDROID_CHANNEL_ID = 'ourweek-reminders';`

4. `src/features/export/services/exportService.ts` (line 118)
   - Change export filename prefix from `weekly-us-` to `ourweek-`

5. `android/app/src/main/java/com/weeklyus/app/MainActivity.java` (line 1)
   - Change: `package com.weeklyus.app;` → `package com.ourweek.app;`

---

### Phase 3: User-Facing Copy (i18n) (1 file)

Update localized strings that users see.

**File to modify:**

- `src/features/localization/messages.ts`
  - Update app name in meta object
  - Update home title from "Weekly Us" to "OurWeek"
  - Update user reference: `weeklyUsUser: 'Weekly Us user'` → `weeklyUsUser: 'OurWeek user'`
  - Update welcome text: "New to Weekly Us?" → "New to OurWeek?"
  - Update subscription plan description

---

### Phase 4: Documentation (4 files)

Update project docs to reflect new branding.

**Files to modify:**

1. `AGENTS.md`
   - Update project identity section (line 3 and following lines)
   - Update all product references from "Weekly Us" to "OurWeek"
   - Update app ID: `com.weeklyus.app` → `com.ourweek.app`

2. `README.md`
   - Update header from "# Weekly Us" to "# OurWeek"
   - Update project description
   - Update all app references
   - Update app ID in setup instructions

3. `DESIGN.md` (line 2)
   - Change: `name: Weekly Us Design System` → `name: OurWeek Design System`

4. `docs/android-mvp-release-readiness.md`
   - Update title to reference OurWeek
   - Update app name from "Weekly Us" to "OurWeek"
   - Update package name from `com.weeklyus.app` to `com.ourweek.app`

---

### Phase 5: Android Folder Restructure (1 change)

Move Java package to match new app ID.

**Action:**

1. Move folder: `android/app/src/main/java/com/weeklyus/` → `android/app/src/main/java/com/ourweek/`
   - This moves MainActivity.java and any other Java files into the new package structure
   - Verify gradle build recognizes new structure after Phase 1 completes

---

### Phase 6: Asset Updates (3+ items)

Update app branding assets (separate task, requires design work).

**Items to update:**

1. App launcher icons (all densities):
   - `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` and variants
   - `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` and variants
   - `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` and variants
   - `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` and variants
   - `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` and variants
   - Round variants for each density

2. Splash screen graphic (referenced in `capacitor.config.ts`):
   - `android/app/src/main/res/drawable/splash_icon.png` or similar

3. PWA/favicon assets (if applicable):
   - `public/` directory assets

---

## Execution Dependencies

- **Phase 1 & Phase 2**: Can run in parallel
- **Phase 3 & Phase 4**: Can run in parallel with Phase 1–2
- **Phase 5**: Depends on Phase 1 completion (must verify gradle recognizes package change)
- **Phase 6**: Independent, but should verify after Phase 1–5 complete

---

## Verification Steps

After implementation:

### 1. Build Verification

```bash
npm run build
npm run check
```

Both commands must complete without errors.

### 2. Android Build

```bash
npm run cap:sync
npm run cap:open:android
```

Verify gradle recognizes new package structure without build errors.

### 3. Visual Verification (Browser)

- Check page title in dev tools (should show "OurWeek")
- Check localStorage keys in browser dev tools (should show `ourweek:*` prefix, not `weekly-us:*`)

### 4. Android Runtime Testing

- Test on emulator or real device
- Verify app ID is correct in APK (`com.ourweek.app`)
- Confirm storage keys are fresh (no legacy data loaded)
- Test app launch, meeting creation, and storage persistence

---

## Decision Log

| Decision                                                | Rationale                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Android Package: `com.weeklyus.app` → `com.ourweek.app` | Standard naming convention for app IDs                                    |
| Storage Strategy: Fresh start                           | Simpler than migration logic for MVP-only test data                       |
| User-Facing Terms: "Weekly Us" → "OurWeek" everywhere   | Consistent branding throughout UI                                         |
| Assets: Separate task                                   | Requires design/artwork creation, not code                                |
| Phase 5 Dependency: After Phase 1                       | Must verify gradle recognizes new package before running android commands |

---

## Files Summary

**Total: 16 files + 1 folder restructure**

| Category           | Files                                                                                                                      | Count |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----- |
| Configuration      | capacitor.config.ts, package.json, index.html, android/app/build.gradle, android/app/src/main/res/values/strings.xml       | 5     |
| Storage Keys       | src/shared/services/storageService.ts, authTokenStorageService.ts, reminderService.ts, exportService.ts, MainActivity.java | 5     |
| Localization       | src/features/localization/messages.ts                                                                                      | 1     |
| Documentation      | AGENTS.md, README.md, DESIGN.md, docs/android-mvp-release-readiness.md                                                     | 4     |
| Folder Restructure | android/app/src/main/java/com/weeklyus/ → android/app/src/main/java/com/ourweek/                                           | 1     |

---

## Notes

- **No data migration**: Existing MVP test data in storage will not be migrated. Fresh app install uses new keys.
- **APK behavior**: Changing appId creates a new app; old APK installations on devices will not auto-update to new version.
- **i18n keys**: Storage keys are internal; no need to update i18n key names themselves (e.g., `common.weeklyUsUser` stays the same, only the translated value changes).
