# Energy Invoice Dashboard

A private-data-first Copilot canvas for exploring Frank Energie invoices. This
repository contains the reusable application source; invoices and parsed
customer data stay in ignored local folders and are never part of Git. The
static `docs/` viewer is hosted by GitHub Pages but loads private analytics only
from a local file in the user's browser.

The dashboard supports Frank Energie settlement and advance PDFs with
electricity and gas data. It preserves duplicate handling, year and month
comparison views, cost breakdowns, injection compensation, capacity peaks,
dark mode, data-quality signals, and local PDF upload, preview, and deletion.
The Pages viewer contains the same analytics, comparison, forecast, quality,
injection, and grid views without the PDF upload or invoice archive.

## Prerequisites

- A Copilot App or CLI environment that supports project-scoped extensions and
  canvases.
- [`pdftotext`](https://poppler.freedesktop.org/) available on `PATH`. The
  extension uses it to extract text from uploaded PDFs.
- A local clone of this repository.
- A modern browser with IndexedDB for the GitHub Pages viewer.

The Copilot runtime supplies `@github/copilot-sdk`; do not install or commit
that package in this repository.

## Quick start: local canvas

1. Clone the repository and open the checkout as a Copilot project.
2. Confirm that `pdftotext` is available by running `pdftotext -v`.
3. Reload or clear the Copilot session so project extensions are rediscovered.
4. Open the **Energy invoice dashboard** canvas.
5. Add one or more Frank Energie PDF invoices with **PDF toevoegen**, or drag
   them onto the upload area.

The canvas is provided by
`.github/extensions/energy-invoice-dashboard/extension.mjs`. Project extension
discovery scans `.github/extensions/`; no separate installation step or
manifest is required.

On first launch, the extension creates the required local runtime directories
and an empty ledger. Uploads are parsed locally and written to the private
runtime directory. Re-uploading the same invoice number safely updates that
invoice rather than creating a second entry.

## Canvas to GitHub Pages workflow

Use this exact workflow for private data:

1. Upload or update a Frank Energie invoice in the local Copilot canvas.
2. Select **Exporteer dashboarddata**. The canvas generates and downloads
   `energy-dashboard-data.json` entirely on the local machine.
3. Open the hosted viewer URL shown under the repository's **Settings >
   Pages**.
4. Select **Laad privé JSON** and choose the downloaded export.
5. Explore the same monthly analytics without uploading PDFs or sending the
   JSON to GitHub or another server.

The loaded snapshot is stored only in that browser's IndexedDB and is restored
after a reload on the same browser and device. **Wis lokale data** removes the
stored snapshot. Loading an updated file replaces the prior snapshot; no Git
commit or push is needed for a data-only change.

The export is a `schemaVersion: 1` monthly snapshot. Its allowlist contains only
analytics fields required by the charts and comparisons. It omits invoice
numbers and dates, customer/address/EAN identifiers, original or stored
filenames, upload timestamps, PDF bytes, and archive-link metadata. Invalid,
oversized, duplicate-month, or privacy-unsafe files produce a visible error
and are not installed.

The Pages viewer is entirely static. It requests only its own HTML and
JavaScript assets; the Content Security Policy blocks data/network connections.
There are no external fonts, APIs, analytics, telemetry, or PDF endpoints.

## Private data and backups

Runtime data is stored only in:

- `.github/extensions/energy-invoice-dashboard/artifacts/ledger.json`
- `.github/extensions/energy-invoice-dashboard/artifacts/invoices/*.pdf`

Optional local exports belong in:

- `.github/extensions/energy-invoice-dashboard/artifacts/exports/`
- `local-exports/`
- `private-exports/`

The root `.gitignore`, the tracked `.gitignore` in `artifacts/`, and the tracked
`.gitignore` in `docs/` protect those paths. Files named
`energy-dashboard-data.json` or `dashboard-data.json`, plus every JSON file
below `docs/`, are ignored. Before any Git operation, treat these runtime paths
as private: do not force-add them, copy them to tracked fixtures, or paste
their contents into issues, logs, or commits.

**GitHub backs up only the extension code in this repository.** Ignored private
files and browser IndexedDB data are not backed up by GitHub. Make a separate,
encrypted backup of `ledger.json`, the PDF directory, and any export that must
be recoverable. An analytics export does not replace the invoice PDFs or the
full ledger.

To restore a backup, copy the backed-up files back to the same ignored paths,
then load the exported JSON into Pages again if needed. A fresh clone contains
all application code but intentionally contains neither the ledger, invoice
PDFs, nor a data export; upload and parse the invoices again only when no
private backup is available.

## Validation and development

Run the JavaScript syntax checks from the repository root:

```sh
node --check .github/extensions/energy-invoice-dashboard/extension.mjs
node --check .github/extensions/energy-invoice-dashboard/invoice-parser.mjs
node --check docs/dashboard-data.js
node --test tests/dashboard-data.test.mjs
```

To validate invoice parsing locally, upload PDFs through the canvas so the same
entry point is exercised. Do not add real invoices, ledger exports, raw PDF text,
customer identifiers, or exact personal totals as test fixtures. Any future
public fixtures must be invented and sanitized.

Before committing or pushing a change, confirm that private runtime data is
still protected:

```sh
git check-ignore -v -- .github/extensions/energy-invoice-dashboard/artifacts/ledger.json
git check-ignore -v -- .github/extensions/energy-invoice-dashboard/artifacts/invoices/example.pdf
git check-ignore -v -- .github/extensions/energy-invoice-dashboard/artifacts/exports/energy-dashboard-data.json
git check-ignore -v -- docs/private-export.json
git status --short --ignored
git diff --cached --name-only
```

The check-ignore commands must identify a matching `.gitignore` rule. The
status output must show the local ledger and invoice directory as ignored
(`!!`), and the staged file list must contain no PDFs, `ledger.json`, or
private dashboard JSON.
