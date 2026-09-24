# Localization catalogue completeness

## Goal

Ensure every translation key used by the application has real English copy, then ensure Ukrainian and Spanish contain an entry for every English key. Existing Ukrainian and Spanish copy remains unchanged.

## Scope

- Treat `messages.en` as the canonical catalogue.
- Recursively compare `en`, `uk`, and `es` message-object paths.
- Search TypeScript and Vue source for literal `t(...)`, `$t(...)`, and shared `translate(...)` keys, then add any referenced English paths that are absent or blank.
- Add Ukrainian and Spanish translations only for newly added English paths or paths missing from those locale objects.
- Preserve all existing non-empty Ukrainian and Spanish strings verbatim.

## Data flow

1. A small audit script reads the message catalogue and enumerates leaf-key paths.
2. The script compares each locale against English and scans source references.
3. Missing English messages receive calm, product-aligned English copy.
4. The matching Ukrainian and Spanish messages are added at the same path.
5. A verification test/script confirms every referenced key resolves in English and that Ukrainian and Spanish match the English path set.

## Error handling

- Dynamic translation keys are not inferred automatically; existing typed/configured mappings are reviewed separately.
- Structural differences such as arrays are compared as their intended value type, so prompt lists remain valid.
- The app keeps English as its configured runtime fallback, but the audit should leave no missing strings that require it.

## Validation

- Run the localization completeness check.
- Run `npm run build` and `npm run check`.
- Manually spot-check the meeting template selection flow in English, Ukrainian, and Spanish.

## Non-goals

- Rewording existing translations.
- Adding locales or changing language-selection behavior.
- Refactoring unrelated product copy.
