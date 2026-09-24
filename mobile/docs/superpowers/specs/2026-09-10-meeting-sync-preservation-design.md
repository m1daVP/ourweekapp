# Preserve meetings across sync and AI generation

The user approved fixing both defects identified in the incident investigation. Preserve local edits during uploads, durably record acknowledged content/revisions, and protect dirty meetings during hydration. Use revision/content comparisons, never wall-clock ordering, for meeting merges. Store unresolved remote versions alongside local sync metadata so neither side is discarded. Existing installations without an acknowledged base must conservatively retain divergent local content. Identical server content can repair a stale revision safely. No database migration or provider change is required.

Hydration and meeting uploads share one queue. Session resets invalidate queued/in-flight work. An acknowledged submitted snapshot advances the local revision even when local content has changed, but never advances it on a conflict or unacknowledged response. AI preflight may upload again after an acknowledged in-flight edit, with a bounded retry; unresolved real conflicts still block AI rather than summarize the wrong version.

Persist metadata with the meeting store in one app-data write so interruption cannot record a clean base without saving its corresponding meeting. Keep local-only fields on acknowledgements. Deletion acknowledgements must be explicit; absent rows are not proof of deletion. Existing user edits and unrelated files are preserved. No commits, deployment, or production data changes are authorized by this task.

Validate delayed uploads, repeated retries, dirty hydration after restart, clean remote updates, missing acknowledgements, genuine conflicts, session changes, and notes/tasks/agreements preservation. Run app tests, build, formatting and lint; physical Android validation remains a release check.
