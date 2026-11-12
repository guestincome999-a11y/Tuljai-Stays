# Booking report exports

Admin Reports and owner Reports now share the supplied Tuljai report branding and a server-side PDF generator. Original logo, Marathi tagline, signature, fonts, and HTML reference live in `backend/src/modules/operations/report-assets/`.

## Using reports

Choose Today, Last 7 days, This month, Last month, or custom dates. Choose Completed stays or All bookings, then apply the dates. Completed stays includes CHECKED_OUT and COMPLETED bookings. Dates filter booking creation time, include both calendar dates, and use India Standard Time. Export buttons stay disabled while filters are unapplied, reports are loading, or the report is empty.

Admin provides PDF download, CSV export, search, paginated booking details, a stay register, and commission by lodge. Owner provides PDF save/share, calendar date selection, search, paginated bookings, and its existing commission and settlement history. The owner ledger is explicitly all-time and independent of report dates.

PDF generation traverses all matching pages and repeats the brand header, footer, table headings, and page numbers. Commission amounts and rates come from stored booking snapshots; fixed commissions display Fixed. Payment methods use recorded paid collections, with At lodge or Not recorded as fallbacks. Exported monetary totals represent the displayed bookings; the eligible commission table and all-time finance ledger retain their separate accounting meanings.

## Deployment

Deploy the backend and admin changes together, then update the owner app. No Python service or new database migration is required. PDFKit is a backend dependency; Nest copies the report assets into its build output using `backend/nest-cli.json`.

Authenticated endpoints:

- `GET /api/admin/reports/bookings/pdf` (ADMIN)
- `GET /api/owner/reports/bookings/pdf` (OWNER or ADMIN; restricted to assigned lodges)

Both accept `startDate`, `endDate`, optional `lodgeId`, and `reportType=completed|all`. PDF export defaults to completed stays. Responses contain `base64`, `filename`, and `bookingCount`. Exports are audit logged.

## Verification

- `npm run test:reports --workspace @tuljai/backend`
- `npm test --workspace @tuljai/owner-app`
- `npm run build --workspace @tuljai/backend`
- `npm run build --workspace @tuljai/admin-panel`
- `npm run typecheck --workspace @tuljai/owner-app`

Report regression coverage includes inclusive IST boundaries, invalid dates, cross-year presets, multi-page traversal, missing dates, owner scoping, PDF page geometry, empty exports, native base64 writing, and share-failure cleanup. Local UI verification uses synthetic data; a live native share-sheet and production-account smoke test remain deployment checks.
