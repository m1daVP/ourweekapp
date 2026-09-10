# Server-Generated Meeting PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a single branded, privacy-safe meeting PDF on the API and deliver it consistently through browser, Android, and iOS export flows.

**Architecture:** The Fastify export module loads an authorized meeting and its workspace-scoped participant names, sanitizes structured data into a PDF document model, and renders bytes with PDFKit and embedded Noto Sans glyph coverage. A new binary endpoint returns the PDF directly; the client retrieves it through an authenticated binary HTTP helper and delivers it using browser download/share or Capacitor cache-and-share behavior.

**Tech Stack:** Node.js 24, Fastify 5, TypeScript 7, Zod 4, PDFKit, Noto Sans, Vue 3, Capacitor Filesystem/Share, Vitest 4.

## Global Constraints

- Retain the existing `POST /v1/exports/meeting` text/Markdown contract unchanged.
- Add `POST /v1/exports/meeting/pdf`; it returns `application/pdf` bytes and never base64 or a public URL.
- PDF export requires a network connection and a meeting already synchronized to the requesting workspace.
- Apply existing authenticated `adult_member` minimum role and Premium `export` entitlement checks before loading or rendering content.
- Every workspace-owned lookup is scoped by `workspace_id`; return the existing `meeting_not_found` 404 shape for records outside that scope.
- Private notes, private marker fields, participant IDs, provider metadata, credentials, and internal IDs must never enter the PDF or logs.
- Use an embedded font with Latin, Latin Extended, and Cyrillic glyph coverage for English, Spanish, and Ukrainian content.
- Keep UI copy in `src/features/localization/messages.ts` for all three supported locales.
- Do not stage or commit without explicit user authorization.
- Do not add a database migration.

---

## File Structure

### API repository: `D:/Projects/myself/weekly-us-api`

- Modify: `package.json`, `package-lock.json` — add server-only PDFKit, its TypeScript declarations, and a Noto Sans font package.
- Create: `src/modules/exports/meeting-pdf.ts` — PDF document-model types, safe text helpers, layout constants, font loading, and `renderMeetingPdf()`.
- Modify: `src/modules/exports/exports.repository.ts` — retrieve meeting and participant names through workspace-scoped repositories.
- Modify: `src/modules/exports/exports.service.ts` — sanitize the persisted meeting and summary, resolve participant display names, and expose `exportMeetingPdf()`.
- Modify: `src/modules/exports/exports.schema.ts` — define the PDF request contract and an OpenAPI binary response schema.
- Modify: `src/modules/exports/exports.routes.ts` — authenticate, authorize, and send PDF bytes with attachment headers.
- Modify: `tests/exports.service.test.ts` — cover PDF service composition, privacy, and workspace-scoped participant names.
- Create: `tests/meeting-pdf.test.ts` — verify the PDF renderer creates branded, valid PDF bytes for complete and sparse models.
- Modify: `tests/exports.routes.test.ts` — cover binary response headers and existing auth/feature/validation failures.
- Modify: `docs/openapi.json` — generated OpenAPI snapshot containing the PDF route.

### Client repository: `D:/Projects/myself/weekly-us`

- Modify: `src/shared/api/httpClient.ts` — share authenticated request/retry mechanics with a binary response reader that safely parses JSON errors.
- Create: `src/shared/api/exportsApi.ts` — call the API PDF endpoint and derive a safe download filename from `Content-Disposition`.
- Modify: `src/shared/services/exportFileDeliveryService.ts` — add a binary-file delivery path without changing the current text-file API.
- Modify: `src/features/export/services/exportService.ts` — remove the print-window/Markdown PDF renderer and expose asynchronous server-PDF delivery.
- Modify: `src/pages/MeetingDetailsPage.vue` — await the export, use the existing loading state, and show localized success/failure feedback.
- Modify: `src/features/localization/messages.ts` — add localized PDF generation/network error copy.
- Modify: `src/shared/api/__tests__/httpClient.test.ts` — prove binary response, JSON error, and refresh behavior.
- Modify: `src/shared/api/__tests__/apiWrappers.test.ts` — prove the PDF wrapper sends the expected authenticated request.
- Create: `src/shared/services/__tests__/exportFileDeliveryService.test.ts` — prove browser and both native cache/share branches handle PDF bytes.
- Create: `src/features/export/services/__tests__/exportService.test.ts` — prove server PDF delivery replaces `window.open`.
- Modify: `src/pages/__tests__/MeetingRecapPages.test.ts` — prove the details-page PDF action is asynchronous, prevents duplicate export, and reports failure.

---

### Task 1: Install the server PDF renderer and build a deterministic document renderer

**Files:**
- Modify: `D:/Projects/myself/weekly-us-api/package.json`
- Modify: `D:/Projects/myself/weekly-us-api/package-lock.json`
- Create: `D:/Projects/myself/weekly-us-api/src/modules/exports/meeting-pdf.ts`
- Create: `D:/Projects/myself/weekly-us-api/tests/meeting-pdf.test.ts`

**Interfaces:**
- Consumes: a fully sanitized `MeetingPdfDocument`; no database, Fastify request, or untrusted JSON is accepted.
- Produces: `renderMeetingPdf(document: MeetingPdfDocument): Promise<Buffer>`.
- Produces: exported `MeetingPdfDocument`, `MeetingPdfSection`, `MeetingPdfTask`, and `MeetingPdfAgreement` types consumed by `ExportsService.exportMeetingPdf()`.

- [ ] **Step 1: Add the server-only rendering dependencies**

Run:

```powershell
npm install pdfkit@0.20.2 @fontsource-variable/noto-sans@5.3.0
npm install -D @types/pdfkit@0.17.6
```

Keep the packages in the API repository. Do not add a PDF dependency to the Vue/Capacitor app.

- [ ] **Step 2: Write failing renderer tests**

Create `tests/meeting-pdf.test.ts` with a complete model containing English, Spanish, and Ukrainian text, an AI summary, notes, a task, and an agreement:

```ts
import { describe, expect, it } from 'vitest';
import { renderMeetingPdf, type MeetingPdfDocument } from '../src/modules/exports/meeting-pdf.js';

const document: MeetingPdfDocument = {
  title: 'Weekly check-in',
  status: 'Completed',
  occurredOn: 'Jun 7, 2026',
  generatedOn: 'Jun 7, 2026',
  privateNotesNotice: 'Private notes are not included.',
  summary: {
    shortSummary: 'A clear plan for the week.',
    mainTopics: ['School pickup', 'Presupuesto'],
    keyTensions: ['Потрібен запасний план'],
    agreements: ['Alternate pickup'],
    tasks: [{ title: 'Book dentist', responsible: 'Rita', dueDate: 'Jun 12, 2026', status: 'Open' }],
    suggestedNextMeetingFocus: ['Review the pickup plan'],
  },
  sections: [{
    title: 'Planning',
    prompt: 'What needs attention?',
    notes: [{ author: 'Rita', createdAt: 'Jun 7, 2026', text: 'Confirm Thursday pickup.' }],
    tasks: [{ title: 'Book dentist', responsible: 'Rita', dueDate: 'Jun 12, 2026', status: 'Open' }],
    agreements: [{ text: 'Alternate pickup', participants: 'Rita, Alex' }],
  }],
};

describe('renderMeetingPdf', () => {
  it('renders a valid branded multi-language PDF', async () => {
    const pdf = await renderMeetingPdf(document);

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it('renders an empty meeting without placeholder lists', async () => {
    const pdf = await renderMeetingPdf({ ...document, summary: undefined, sections: [] });

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
```

- [ ] **Step 3: Run the renderer tests to verify they fail**

Run:

```powershell
npm test -- tests/meeting-pdf.test.ts
```

Expected: FAIL because `meeting-pdf.ts` does not exist.

- [ ] **Step 4: Define the document model and renderer**

Create `src/modules/exports/meeting-pdf.ts`. Keep the renderer independent from persistence and rendering input narrow:

```ts
export type MeetingPdfTask = {
  title: string;
  description?: string;
  responsible?: string;
  dueDate?: string;
  status?: string;
};

export type MeetingPdfSection = {
  title: string;
  prompt?: string;
  notes: Array<{ author?: string; createdAt?: string; text: string }>;
  tasks: MeetingPdfTask[];
  agreements: Array<{ text: string; description?: string; participants?: string }>;
};

export type MeetingPdfDocument = {
  title: string;
  status: string;
  occurredOn: string;
  generatedOn: string;
  privateNotesNotice: string;
  summary?: {
    shortSummary: string;
    mainTopics: string[];
    keyTensions: string[];
    agreements: string[];
    tasks: MeetingPdfTask[];
    suggestedNextMeetingFocus: string[];
  };
  sections: MeetingPdfSection[];
};

export async function renderMeetingPdf(input: MeetingPdfDocument): Promise<Buffer> {
  // Create an A4 PDFDocument with bufferPages enabled, register the Noto Sans
  // Latin Extended and Cyrillic WOFF2 files, draw header/content/footer, and
  // resolve the stream only after doc.end().
}
```

Use `PDFDocument` with `size: 'A4'`, `bufferPages: true`, 48-point side margins, and 60-point header/footer space. Load the Noto Sans Latin Extended and Cyrillic WOFF2 package files with `createRequire(import.meta.url).resolve(...)`; register both fonts and select the appropriate registered font before drawing each text string. Use `heightOfString()` to call `addPage()` before an entry that would overlap the footer. Draw the OurWeek wordmark, title/status/date metadata, summary groups, section headings, prompt, notes, task cards, agreement cards, the private-notes notice, and page-number footer. Do not draw an empty group label.

- [ ] **Step 5: Run renderer tests and typecheck**

Run:

```powershell
npm test -- tests/meeting-pdf.test.ts
npm run typecheck
```

Expected: PASS. The first bytes are `%PDF-`; a document with Cyrillic text is created without a font error.

---

### Task 2: Build the authorized PDF export model in the API service

**Files:**
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/exports/exports.repository.ts`
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/exports/exports.service.ts`
- Modify: `D:/Projects/myself/weekly-us-api/tests/exports.service.test.ts`

**Interfaces:**
- Consumes: `AuthContext`, `ExportMeetingPdfRequestDto`, `ExportsRepository.findMeetingForExport(workspaceId, meetingId)`, `ExportsRepository.listParticipantNamesForWorkspace(workspaceId, participantIds)`, and `renderMeetingPdf()`.
- Produces: `ExportsService.exportMeetingPdf(auth, request, now): Promise<{ filename: string; content: Buffer }>`.
- Guarantees: only names returned by the workspace-scoped participant repository appear in the document model; unknown/deleted IDs are omitted.

- [ ] **Step 1: Write failing service tests**

Add a PDF harness to `tests/exports.service.test.ts`:

```ts
it('builds a privacy-safe PDF using workspace-scoped participant names', async () => {
  const renderPdf = vi.fn().mockResolvedValue(Buffer.from('%PDF-test'));
  const { repository, service } = createHarness({
    renderPdf,
    participantNames: [
      { id: 'participant_1', name: 'Rita' },
      { id: 'participant_2', name: 'Alex' },
    ],
  });

  const result = await service.exportMeetingPdf(auth, { meetingId }, new Date(now));

  expect(repository.listParticipantNamesForWorkspace).toHaveBeenCalledWith(
    workspaceId,
    ['participant_1'],
  );
  expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({
    sections: [expect.objectContaining({
      notes: [expect.objectContaining({ author: 'Rita' })],
      tasks: [expect.objectContaining({ responsible: 'Rita' })],
      agreements: [expect.objectContaining({ participants: 'Rita' })],
    })],
  }));
  expect(result.content.subarray(0, 5).toString()).toBe('%PDF-');
});

it('does not pass private note text or participant IDs to the PDF renderer', async () => {
  const { service, renderPdf } = createHarness();
  await service.exportMeetingPdf(auth, { meetingId }, new Date(now));

  expect(JSON.stringify(renderPdf.mock.calls)).not.toContain('private true text');
  expect(JSON.stringify(renderPdf.mock.calls)).not.toContain('participant_1');
});
```

Also add assertions that a missing meeting returns `meeting_not_found`, and that `viewerAuth` is rejected before both repository methods or the renderer execute.

- [ ] **Step 2: Run the service tests to verify they fail**

Run:

```powershell
npm test -- tests/exports.service.test.ts
```

Expected: FAIL because `exportMeetingPdf` and the participant-name repository method do not exist.

- [ ] **Step 3: Add the participant-name query and PDF service method**

In `exports.repository.ts`, construct a `ParticipantsRepository` next to the current `MeetingsRepository` and expose:

```ts
async listParticipantNamesForWorkspace(workspaceId: string, participantIds: string[]) {
  return this.participantsRepository.listParticipantNamesForWorkspace(
    workspaceId,
    participantIds,
  );
}
```

In `exports.service.ts`:
- Expand `ExportsRepositoryPort` with that method and inject `renderMeetingPdf` as an optional constructor dependency for testability.
- Collect only sanitized note `participantId`, task `responsibleParticipantIds`, and agreement `participantIds`; deduplicate them before querying names.
- Convert those names into a local `Map<string, string>`, then resolve labels with `names.get(id)` and omit unknown IDs.
- Parse `meeting.aiSummary` with the existing `meetingSummarySchema.safeParse()`. If parsing fails, omit the summary; do not pass raw JSON through.
- Convert dates to an explicit, locale-neutral API PDF format such as `2026-06-07`. Use title-case status labels derived from the controlled status enum.
- Call `renderMeetingPdf()` with the sanitized document model and return `{ content, filename: toPdfFilename(meeting) }`, where the filename is `ourweek-YYYY-MM-DD-<ascii-slug>.pdf`.

- [ ] **Step 4: Run focused service and renderer tests**

Run:

```powershell
npm test -- tests/exports.service.test.ts tests/meeting-pdf.test.ts
```

Expected: PASS. Existing text/Markdown assertions remain unchanged; PDF composition has readable participant names and no private data or IDs.

---

### Task 3: Expose the binary PDF endpoint and preserve the OpenAPI contract

**Files:**
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/exports/exports.schema.ts`
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/exports/exports.routes.ts`
- Modify: `D:/Projects/myself/weekly-us-api/tests/exports.routes.test.ts`
- Modify: `D:/Projects/myself/weekly-us-api/docs/openapi.json`

**Interfaces:**
- Consumes: `ExportsService.exportMeetingPdf(auth, { meetingId })`.
- Produces: `POST /v1/exports/meeting/pdf`, returning a binary PDF attachment.
- Guarantees: success sets `application/pdf` and an attachment filename; expected failures retain the existing JSON `errorResponseSchema`.

- [ ] **Step 1: Write failing route tests**

Add the following test and retain the existing auth/role/premium/422 route tests for the text endpoint:

```ts
it('returns a PDF attachment through route wiring', async () => {
  routeExportMeetingPdf.mockResolvedValueOnce({
    filename: 'ourweek-2026-06-07-weekly-check-in.pdf',
    content: Buffer.from('%PDF-1.7'),
  });
  const app = await buildExportsRoutesApp();

  const response = await app.inject({
    method: 'POST',
    url: '/v1/exports/meeting/pdf',
    headers: { authorization: 'Bearer premium-token' },
    payload: { meetingId: '11111111-1111-4111-8111-111111111111' },
  });

  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('application/pdf');
  expect(response.headers['content-disposition']).toContain(
    'attachment; filename="ourweek-2026-06-07-weekly-check-in.pdf"',
  );
  expect(response.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  expect(routeExportMeetingPdf).toHaveBeenCalledWith(
    expect.objectContaining({ workspaceId: '33333333-3333-4333-8333-333333333333' }),
    { meetingId: '11111111-1111-4111-8111-111111111111' },
  );
  await app.close();
});
```

Add equivalent unauthenticated, viewer, free-Premium, malformed-UUID, and missing-meeting cases against `/meeting/pdf`.

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```powershell
npm test -- tests/exports.routes.test.ts
```

Expected: FAIL because the PDF route and mocked method do not exist.

- [ ] **Step 3: Define route schema and send bytes without JSON serialization**

In `exports.schema.ts`, add:

```ts
export const exportMeetingPdfRequestSchema = z.object({
  meetingId: meetingIdSchema,
});

export const exportMeetingPdfResponseSchema = z.string().meta({
  contentMediaType: 'application/pdf',
});
export type ExportMeetingPdfRequestDto = z.infer<typeof exportMeetingPdfRequestSchema>;
```

In `exports.routes.ts`, add a second `app.post('/meeting/pdf', ...)` using the same pre-handlers. Set `schema.body` to the PDF request schema, include a 200 OpenAPI response declaring `application/pdf`, and keep 401/403/404/422/500 error schemas. In the handler, bypass JSON serialization only for the byte payload:

```ts
const pdf = await service.exportMeetingPdf(request.auth, request.body);
return reply
  .type('application/pdf')
  .header('content-disposition', `attachment; filename="${pdf.filename}"`)
  .header('cache-control', 'private, no-store')
  .send(pdf.content);
```

Use Fastify's raw schema/OpenAPI support if the Zod serializer rejects a `Buffer`; the route's runtime response must stay a Buffer while the generated 200 OpenAPI content type is `application/pdf`.

- [ ] **Step 4: Generate and verify the OpenAPI snapshot**

Run:

```powershell
npm test -- tests/exports.routes.test.ts
npm run openapi:generate
npm run openapi:check
```

Expected: PASS. `docs/openapi.json` has `/v1/exports/meeting/pdf` with the authentication errors and PDF media type.

---

### Task 4: Add a reusable authenticated binary response reader and PDF API wrapper

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/httpClient.ts`
- Create: `D:/Projects/myself/weekly-us/src/shared/api/exportsApi.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/__tests__/httpClient.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/__tests__/apiWrappers.test.ts`

**Interfaces:**
- Produces: `apiRequestBlob(path, options): Promise<{ blob: Blob; contentDisposition: string | null }>`.
- Produces: `exportMeetingPdf(meetingId): Promise<{ blob: Blob; fileName: string }>`.
- Guarantees: requests use the same bearer token and one-time 401 refresh behavior as `apiRequest()`; non-2xx JSON errors become `ApiClientError`.

- [ ] **Step 1: Write failing binary-client tests**

Add to `httpClient.test.ts`:

```ts
it('returns an authenticated PDF Blob and preserves content disposition', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    { headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'attachment; filename="weekly.pdf"',
    } },
  )));
  const { apiRequestBlob, setApiAuthHandlers } = await loadHttpClient();
  setApiAuthHandlers({ getAccessToken: () => 'access-token' });

  const result = await apiRequestBlob('/exports/meeting/pdf', {
    method: 'POST',
    body: { meetingId: 'meeting-1' },
    requiresAuth: true,
  });

  expect(result.blob.type).toBe('application/pdf');
  expect(result.contentDisposition).toContain('filename="weekly.pdf"');
});
```

Add a JSON 404 response test asserting `ApiClientError { status: 404, code: 'meeting_not_found' }`, plus a 401-then-success test proving the existing refresh handler is called once before the Blob is returned.

- [ ] **Step 2: Run the binary-client tests to verify they fail**

Run:

```powershell
npm test -- src/shared/api/__tests__/httpClient.test.ts
```

Expected: FAIL because `apiRequestBlob` does not exist.

- [ ] **Step 3: Refactor the HTTP client around a response parser and add the export wrapper**

In `httpClient.ts`, parameterize the internal request function with a success parser while keeping `apiRequest<T>()` behavior unchanged:

```ts
type SuccessResponseParser<T> = (response: Response) => Promise<T>;

export async function apiRequestBlob(
  path: string,
  options: ApiRequestOptions = {},
): Promise<{ blob: Blob; contentDisposition: string | null }> {
  return requestWithParser(path, options, async (response) => ({
    blob: await response.blob(),
    contentDisposition: response.headers.get('content-disposition'),
  }));
}
```

Read JSON once for non-success responses before calling the parser. Reuse the same parser in the refresh retry so a refreshed binary request still returns a Blob.

Create `exportsApi.ts`:

```ts
import { apiRequestBlob } from './httpClient';

export async function exportMeetingPdf(meetingId: string) {
  const result = await apiRequestBlob('/exports/meeting/pdf', {
    method: 'POST',
    body: { meetingId },
    requiresAuth: true,
  });

  return {
    blob: result.blob,
    fileName: filenameFromContentDisposition(
      result.contentDisposition,
      `ourweek-meeting-${meetingId}.pdf`,
    ),
  };
}
```

Parse `filename` and RFC 5987 `filename*` values defensively, reject path separators/control characters, and fall back to the supplied safe filename. Add an `apiWrappers.test.ts` assertion for the wrapper request.

- [ ] **Step 4: Run focused client API tests**

Run:

```powershell
npm test -- src/shared/api/__tests__/httpClient.test.ts src/shared/api/__tests__/apiWrappers.test.ts
npm run typecheck
```

Expected: PASS. Existing JSON wrapper and refresh behavior are unchanged.

---

### Task 5: Deliver PDF bytes on browser, Android, and iOS, then wire the details-page action

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/shared/services/exportFileDeliveryService.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/export/services/exportService.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingDetailsPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/localization/messages.ts`
- Create: `D:/Projects/myself/weekly-us/src/shared/services/__tests__/exportFileDeliveryService.test.ts`
- Create: `D:/Projects/myself/weekly-us/src/features/export/services/__tests__/exportService.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**
- Consumes: `exportMeetingPdf(meetingId)` from `exportsApi.ts`.
- Produces: `exportMeetingAsPdf(meetingId): Promise<'shared' | 'downloaded'>`.
- Produces: `deliverBinaryExportFile(file): Promise<'shared' | 'downloaded'>`.
- Guarantees: PDF export no longer calls `window.open`, `document.write`, or `window.print`; text/Markdown export remains unchanged.

- [ ] **Step 1: Write failing delivery tests**

Create `exportFileDeliveryService.test.ts` with mocked Capacitor, Filesystem, Share, DOM, and `URL`:

```ts
it('downloads PDF bytes in a browser', async () => {
  await deliverBinaryExportFile({
    content: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
    fileName: 'weekly.pdf',
    mimeType: 'application/pdf',
  });

  expect(createObjectURL).toHaveBeenCalled();
  expect(anchor.click).toHaveBeenCalled();
});

it.each(['android', 'ios'] as const)(
  'writes a base64 PDF to cache and shares it on %s',
  async (platform) => {
    getPlatform.mockReturnValue(platform);
    await deliverBinaryExportFile({
      content: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
      fileName: 'weekly.pdf',
      mimeType: 'application/pdf',
    });

    expect(Filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      path: 'weekly.pdf',
      directory: Directory.Cache,
      data: expect.any(String),
    }));
    expect(Share.share).toHaveBeenCalled();
    expect(Filesystem.deleteFile).toHaveBeenCalled();
  },
);
```

Create `exportService.test.ts` asserting that `exportMeetingAsPdf('meeting-1')` calls the API wrapper and `deliverBinaryExportFile`, and contains no mocked `window.open` dependency.

- [ ] **Step 2: Run delivery and export-service tests to verify they fail**

Run:

```powershell
npm test -- src/shared/services/__tests__/exportFileDeliveryService.test.ts src/features/export/services/__tests__/exportService.test.ts
```

Expected: FAIL because binary delivery and the asynchronous ID-based PDF export do not exist.

- [ ] **Step 3: Add a binary delivery branch without changing text delivery**

In `exportFileDeliveryService.ts`, retain `ExportFileDelivery` and its UTF-8 text methods. Add:

```ts
export type BinaryExportFileDelivery = {
  content: Blob;
  fileName: string;
  mimeType: 'application/pdf';
  title?: string;
};

export async function deliverBinaryExportFile(
  file: BinaryExportFileDelivery,
): Promise<'shared' | 'downloaded'> {
  if (Capacitor.isNativePlatform()) {
    return shareBinaryFileOnNative(file);
  }

  return shareBinaryFileInBrowser(file);
}
```

For native delivery, convert `await file.content.arrayBuffer()` to a base64 string, call `Filesystem.writeFile({ directory: Directory.Cache, path, data: base64, recursive: true })` without `Encoding.UTF8`, call `Share.share({ files: [uri] })`, and delete the cache file in `finally`. Use this branch for both Android and iOS. For browser delivery, first use `navigator.share` when `canShare({ files: [File] })` accepts the PDF; otherwise trigger a Blob URL download.

In `exportService.ts`, remove `escapeHtml` and the print-window implementation. Import `exportMeetingPdf` and `deliverBinaryExportFile`, then expose:

```ts
export async function exportMeetingAsPdf(meetingId: string) {
  const file = await exportMeetingPdf(meetingId);

  return deliverBinaryExportFile({
    content: file.blob,
    fileName: file.fileName,
    mimeType: 'application/pdf',
    title: file.fileName,
  });
}
```

Keep `MeetingExportContext`, Markdown, and text functions exactly as they are.

- [ ] **Step 4: Convert the details-page PDF action to an awaited stateful action**

In `MeetingDetailsPage.vue`, replace the synchronous `printPdfExport()` logic with an `async` function that:
- returns immediately when no meeting is present or an export is already running;
- clears `exportError`, sets `isExporting`, and calls `await exportMeetingAsPdf(meeting.value.id)`;
- shows the existing shared/saved notification based on the delivery result;
- maps `ApiClientError.code === 'meeting_not_found'` to a new localized message explaining that the meeting must sync before PDF export;
- maps other errors to a new localized retry message;
- resets `isExporting` in `finally`.

Add `meeting.pdfRequiresSync` and `meeting.pdfFailed` in English, Ukrainian, and Spanish. Replace the old print-dialog success/error strings only where they are no longer used.

- [ ] **Step 5: Run focused frontend tests**

Run:

```powershell
npm test -- src/shared/services/__tests__/exportFileDeliveryService.test.ts src/features/export/services/__tests__/exportService.test.ts src/pages/__tests__/MeetingRecapPages.test.ts
npm run typecheck
```

Expected: PASS. The PDF control is disabled while waiting, preserves the old local text/Markdown paths, and routes errors to localized messages.

---

### Task 6: Verify generated artifact quality and full repository contracts

**Files:**
- Modify: only files required by fixes discovered in this verification task.
- Test: API and client tests from Tasks 1-5.

**Interfaces:**
- Consumes: completed binary endpoint and client delivery flow.
- Produces: a verified API contract, a valid multi-page PDF, and a release-ready manual QA record.

- [ ] **Step 1: Run all automated verification**

Run:

```powershell
npm run typecheck
npm test
npm run openapi:check
```

Working directory: `D:/Projects/myself/weekly-us-api`.

Then run:

```powershell
npm run typecheck
npm test
npm run build
npm run check
```

Working directory: `D:/Projects/myself/weekly-us`.

Expected: PASS. Do not suppress or skip failures; fix the source cause and rerun the affected command.

- [ ] **Step 2: Render and inspect representative PDFs**

Use a completed meeting with:
- an AI summary;
- 20+ notes/tasks/agreements spanning more than one A4 page;
- English, Spanish accents, and Ukrainian Cyrillic;
- at least one private-marked note and deleted/unknown participant ID.

Verify:
- the PDF opens and its first bytes are `%PDF-`;
- the masthead, hierarchy, section dividers, and footer are visible on every page;
- no entry overlaps the footer or is split mid-card;
- private notes, raw Markdown markers, participant IDs, and internal metadata are absent;
- known participants render as names and unknown/deleted IDs are omitted;
- browser, Android, and iOS receive the same bytes.

- [ ] **Step 3: Perform native delivery QA**

Run:

```powershell
npm run cap:sync
```

Working directory: `D:/Projects/myself/weekly-us`.

On a physical Android device and iOS simulator/device:
- open a synced completed meeting and select PDF;
- confirm the native share sheet receives a readable `.pdf` file;
- cancel sharing and confirm the app stays usable;
- share the file and confirm the cache cleanup does not report an error;
- disable network or use an unsynced local-only meeting and confirm the localized retry/sync message appears;
- verify text and Markdown exports still work offline.

- [ ] **Step 4: Review the final change set**

Confirm:
- `docs/openapi.json` is regenerated rather than hand-edited;
- no SQL migration exists;
- no browser print-window code remains;
- PDFs are never stored on the server or exposed through a public URL;
- package lockfiles include only the approved PDF/font dependencies;
- no files are staged or committed without a separate explicit user request.
