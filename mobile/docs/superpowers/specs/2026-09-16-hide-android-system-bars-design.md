# Hide Android System Bars

## Goal

Run the Capacitor application in immersive full-screen mode by hiding both the Android status bar and navigation bar while the app is active.

## Approach

Use Capacitor 8's bundled `SystemBars` configuration in `capacitor.config.ts` with `hidden: true`. Keep `insetsHandling: 'css'` enabled so the WebView exposes safe-area inset variables for layouts that need to avoid display cutouts and gesture regions.

This approach is preferred over custom Java code because the project already uses Capacitor 8, the behavior is app-wide, and no runtime toggle is required.

## Behavior

- Both system bars are hidden when the native application starts.
- Android may reveal the bars temporarily when the user swipes from a screen edge.
- Browser development is unaffected.
- Existing safe-area CSS remains responsible for keeping important controls away from cutouts and gesture areas.
- The splash screen configuration is unchanged; this change applies to the running application.

## Failure Handling

No new runtime failure path is introduced because the behavior is declarative Capacitor configuration. If a platform does not support the requested visibility behavior, the system bars remain under operating-system control.

## Verification

- Run the production build and project checks.
- Sync the Android Capacitor project.
- Confirm on a real Android device that both bars are hidden after launch and can appear transiently after an edge swipe.
