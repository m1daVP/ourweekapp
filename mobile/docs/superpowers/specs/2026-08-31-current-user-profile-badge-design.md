# Current User Profile Badge

## Problem

`AppShell` always renders the first active household participant in the top
bar. An invited member therefore sees the owner’s initials and avatar color
instead of their own profile badge.

## Design

Use the authenticated user’s normalized email to select the matching active
participant, whose invitation acceptance already links and returns that email.
Render only that participant’s initials and avatar color in the top bar. Show
the existing neutral `WU` badge while authenticated participant data is not yet
available.

No backend, database, API-contract, or persistent selection-state change is
needed. Development data contains no legacy unlinked participants.

## Verification

Add an `AppShell` component test that supplies multiple active participants and
a signed-in member email, then asserts the displayed badge uses the matched
participant’s initials and avatar color.

## Self-review

This is a focused presentation fix. Email comparison is normalized on both
sides, no user data is added to storage, and the loading fallback remains
safe.
