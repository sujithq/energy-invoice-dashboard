# Energy Invoice Dashboard

A private-data-first Copilot canvas for exploring Frank Energie invoices. This
repository contains the reusable application source; invoices and parsed
customer data stay in an ignored local folder and are never part of Git.

The dashboard supports Frank Energie settlement and advance PDFs with
electricity and gas data. It preserves duplicate handling, year and month
comparison views, cost breakdowns, injection compensation, capacity peaks,
dark mode, data-quality signals, and local PDF upload, preview, and deletion.

## Prerequisites

- A Copilot App or CLI environment that supports project-scoped extensions and
  canvases.
- [`pdftotext`](https://poppler.freedesktop.org/) available on `PATH`. The
  extension uses it to extract text from uploaded PDFs.
- A local clone of this repository.

The Copilot runtime supplies `@github/copilot-sdk`; do not install or commit
that package in this repository.

## Quick start

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

## Private data and backups

Runtime data is stored only in:

- `.github/extensions/energy-invoice-dashboard/artifacts/ledger.json`
- `.github/extensions/energy-invoice-dashboard/artifacts/invoices/*.pdf`

The root `.gitignore` and the tracked `.gitignore` in `artifacts/` both protect
that directory. Before any Git operation, treat the contents of `artifacts/`
as private: do not force-add them, copy them to tracked fixtures, or paste their
contents into issues, logs, or commits.

**GitHub backs up only the extension code in this repository.** Ignored private
files are not backed up by GitHub. Make a separate, encrypted backup of
`ledger.json` and the PDF directory if the invoice archive must be recoverable.

To restore a backup, copy the backed-up files back to the same ignored paths.
A fresh clone contains all application code but intentionally contains neither
the ledger nor invoice PDFs; upload the invoices again only when no private
backup is available.

## Validation and development

Run the JavaScript syntax checks from the repository root:

```sh
node --check .github/extensions/energy-invoice-dashboard/extension.mjs
node --check .github/extensions/energy-invoice-dashboard/invoice-parser.mjs
```

To validate invoice parsing locally, upload PDFs through the canvas so the same
entry point is exercised. Do not add real invoices, ledger exports, raw PDF text,
customer identifiers, or exact personal totals as test fixtures. Any future
public fixtures must be invented and sanitized.
