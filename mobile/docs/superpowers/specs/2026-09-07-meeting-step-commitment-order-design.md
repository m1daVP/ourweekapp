# Meeting step commitment order

## Goal

Make actionable commitments easier to find during a meeting by showing a step's existing tasks and agreements before its notes.

## Scope

- Change presentation order only in the current meeting-section step.
- When present, render tasks first, agreements second, and notes last.
- Keep each list's existing controls, empty states, permissions, and data unchanged.
- Do not alter stored meeting data, creation flows, or other pages.

## Verification

- Add or update a component test that confirms the rendered order when a section has tasks, agreements, and notes.
- Run the project's build and checks.
