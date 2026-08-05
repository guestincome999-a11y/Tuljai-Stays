'use client';

import type { BulkLodgeImportResult, BulkLodgeImportRow } from '@tuljai/types';
import Link from 'next/link';
import { useState } from 'react';

import { bulkImportGovernanceLodges } from '../../../../src/api/admin-governance-api';
import { PermissionGate } from '../../../../src/components/PermissionGate';
import { parseLodgeImportFile } from '../../../../src/lodges/lodge-import';

export default function ImportLodgesPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkLodgeImportRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BulkLodgeImportResult | null>(null);

  async function selectFile(file: File | undefined) {
    setRows([]);
    setValidationErrors([]);
    setErrorMessage(null);
    setResult(null);
    setFileName(file?.name ?? null);
    if (!file) return;

    setIsParsing(true);
    try {
      const parsed = await parseLodgeImportFile(file);
      setRows(parsed.rows);
      setValidationErrors(parsed.errors);
    } catch {
      setValidationErrors([
        'This workbook could not be read. Start with the Tuljai Stays template and save it as .xlsx.',
      ]);
    } finally {
      setIsParsing(false);
    }
  }

  async function importRows() {
    if (!rows.length || validationErrors.length) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      setResult(await bulkImportGovernanceLodges(rows));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The lodges could not be imported.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const publishedCount = rows.filter((row) => row.publishLive).length;

  return (
    <PermissionGate permission="lodges.manage">
      <div className="page-stack">
        <section className="hero-panel command-hero">
          <div>
            <p className="eyebrow">Lodge Management</p>
            <h2>Import Lodges from Excel</h2>
            <p className="muted-copy">
              Add lodge profiles, addresses, amenities, and primary owner assignments in one batch.
            </p>
          </div>
          <Link className="button button-secondary" href="/admin/lodges">
            Back to Lodges
          </Link>
        </section>

        <section className="grid grid-3 import-step-grid">
          <StepCard number="1" title="Download the template">
            Keep the column names unchanged. Phone numbers must include the country code.
            <a
              className="button button-secondary"
              download
              href="/templates/tuljai-lodge-import-template.xlsx"
            >
              Download Excel Template
            </a>
          </StepCard>
          <StepCard number="2" title="Add lodge details">
            Use one row per lodge. The owner phone is matched to an active Tuljai Stays account;
            owner email is used as a fallback.
          </StepCard>
          <StepCard number="3" title="Review and import">
            The full file is checked before any data is saved. Rows marked YES in publish_live
            become visible in the pilgrim app immediately.
          </StepCard>
        </section>

        <section className="panel form-stack">
          <div>
            <p className="eyebrow">Upload</p>
            <h3>Choose the completed workbook</h3>
            <p className="muted-copy">
              Maximum 500 lodges per import. Only .xlsx files are accepted.
            </p>
          </div>
          <label className="file-drop-field">
            <span>
              {isParsing ? 'Reading workbook…' : (fileName ?? 'Select an Excel workbook')}
            </span>
            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isParsing || isSubmitting}
              type="file"
              onChange={(event) => void selectFile(event.target.files?.[0])}
            />
          </label>
        </section>

        {validationErrors.length ? (
          <section className="error-banner import-error-list">
            <strong>Fix these items in the workbook:</strong>
            <ul>
              {validationErrors.slice(0, 25).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        {result ? (
          <section className="success-banner import-result-banner">
            <div>
              <strong>{result.importedCount} lodges imported successfully.</strong>
              <span>
                {result.ownerAssignments} owners assigned · {result.publishedCount} published live
              </span>
            </div>
            <Link className="button button-primary" href="/admin/lodges">
              View Lodges
            </Link>
          </section>
        ) : null}

        {rows.length ? (
          <>
            <section className="grid grid-3">
              <MetricCard label="Rows ready" value={rows.length} />
              <MetricCard label="Owner matches requested" value={rows.length} />
              <MetricCard label="Publish live" value={publishedCount} />
            </section>

            <section className="table-panel">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">Preview</p>
                  <h3>First {Math.min(rows.length, 20)} rows</h3>
                </div>
                <button
                  className="button button-primary"
                  disabled={Boolean(result) || isSubmitting || validationErrors.length > 0}
                  type="button"
                  onClick={() => void importRows()}
                >
                  {isSubmitting ? 'Importing…' : `Import ${rows.length} Lodges`}
                </button>
              </div>
              <div className="admin-table lodge-import-table">
                <div className="admin-table-row admin-table-head">
                  <span>Row</span>
                  <span>Lodge</span>
                  <span>City</span>
                  <span>Owner match</span>
                  <span>Amenities</span>
                  <span>Visibility</span>
                </div>
                {rows.slice(0, 20).map((row) => (
                  <div className="admin-table-row" key={`${row.rowNumber}-${row.slug}`}>
                    <span>{row.rowNumber}</span>
                    <span>
                      <strong>{row.name}</strong>
                      <small>{row.slug}</small>
                    </span>
                    <span>{row.citySlug}</span>
                    <span>
                      {row.ownerName ?? 'Account owner'}
                      <small>{row.ownerPhone}</small>
                    </span>
                    <span>{row.amenitySlugs?.length ?? 0}</span>
                    <span className="status-card">{row.publishLive ? 'Live' : 'Draft'}</span>
                  </div>
                ))}
              </div>
              {rows.length > 20 ? (
                <p className="muted-copy">
                  {rows.length - 20} additional rows will also be imported.
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </PermissionGate>
  );
}

function StepCard({
  children,
  number,
  title,
}: {
  children: React.ReactNode;
  number: string;
  title: string;
}) {
  return (
    <article className="panel import-step-card">
      <span className="import-step-number">{number}</span>
      <h3>{title}</h3>
      <p className="muted-copy">{children}</p>
    </article>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">XL</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
