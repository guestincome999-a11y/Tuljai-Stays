'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  listPendingGovernancePhotos,
  type PendingPhoto,
  updateGovernancePhotoApproval,
} from '../../../src/api/admin-governance-api';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  formatGovernanceStatus,
  photoRejectReasons,
} from '../../../src/governance/governance-utils';

export default function AdminPhotoReviewPage() {
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState(photoRejectReasons[0] ?? 'Photo rejected');

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      setPhotos(await listPendingGovernancePhotos());
    } catch {
      setErrorMessage('Pending photos could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function reviewPhoto(photoId: string, approved: boolean) {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateGovernancePhotoApproval(
        photoId,
        approved ? 'APPROVED' : 'REJECTED',
        approved ? undefined : { rejectionReason: rejectReason },
      );
      await load();
      setSuccessMessage(approved ? 'Photo approved.' : 'Photo rejected.');
    } catch {
      setErrorMessage('Photo review action failed.');
    }
  }

  return (
    <PermissionGate permission="photos.review">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Photo Review</p>
            <h2>Pending lodge photos</h2>
            <p className="muted-copy">
              Approve clear, accurate lodge media and reject duplicates or unsafe images.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="panel">
          <label className="form-field">
            <span>Default rejection reason</span>
            <select value={rejectReason} onChange={(event) => setRejectReason(event.target.value)}>
              {photoRejectReasons.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="photo-grid">
          {photos.map((photo) => (
            <article className="photo-card" key={photo.id}>
              <img
                alt={`${photo.lodgeName ?? 'Lodge'} ${photo.category}`}
                src={photo.thumbnailUrl ?? photo.fileUrl}
              />
              <strong>{photo.lodgeName ?? photo.lodgeId}</strong>
              <span>{formatGovernanceStatus(photo.category)}</span>
              <span className="status-card">{formatGovernanceStatus(photo.approvalStatus)}</span>
              <div className="row-actions">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => void reviewPhoto(photo.id, true)}
                >
                  Approve
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => void reviewPhoto(photo.id, false)}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </section>

        {photos.length === 0 ? (
          <section className="panel">
            <p className="empty-table">No pending photos are waiting for review.</p>
          </section>
        ) : null}
      </div>
    </PermissionGate>
  );
}
