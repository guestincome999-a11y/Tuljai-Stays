'use client';

import type { Review, ReviewStatus } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { listAdminReviews, moderateAdminReview } from '../../../src/api/admin-reviews-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

const moderationActions: Array<{ label: string; status: ReviewStatus }> = [
  { label: 'Approve', status: 'PUBLISHED' },
  { label: 'Hide', status: 'HIDDEN' },
  { label: 'Flag', status: 'REPORTED' },
];

export default function ReviewModerationPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await listAdminReviews();
      setReviews(response.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(review: Review, status: ReviewStatus) {
    if (savingId) return;
    setSavingId(review.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await moderateAdminReview(review.id, status);
      setReviews((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setSuccessMessage(`Review ${status.toLowerCase()} successfully.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update this review.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <PermissionGate permission="reviews.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Trust & Safety</p>
            <h2>Review moderation</h2>
            <p className="muted-copy">
              Review genuine guest feedback, approve it for public display, hide unsuitable content,
              or flag it for further investigation.
            </p>
          </div>
          <button className="button button-secondary" disabled={loading} type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? (
          <section className="error-banner">
            <span>{errorMessage}</span>
            <button className="button button-secondary" type="button" onClick={() => void load()}>
              Retry
            </button>
          </section>
        ) : null}
        {successMessage ? <p className="success-banner">{successMessage}</p> : null}

        <section className="panel">
          {loading ? <p className="muted-copy">Loading reviews…</p> : null}
          {!loading && reviews.length === 0 ? (
            <div className="empty-state">
              <h3>No reviews found</h3>
              <p className="muted-copy">There are no reviews in the current moderation queue.</p>
            </div>
          ) : null}
          {!loading && reviews.length > 0 ? (
            <div className="admin-table">
              {reviews.map((review) => (
                <article className="admin-table-row" key={review.id}>
                  <div>
                    <strong>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong>
                    <h3>{review.title ?? 'Pilgrim review'}</h3>
                    <p>{review.comment ?? 'No written comment.'}</p>
                    <p className="muted-copy">
                      {review.isVerifiedStay ? 'Verified stay' : 'Unverified stay'} ·{' '}
                      {new Date(review.createdAt).toLocaleDateString('en-IN')} · Lodge {review.lodgeId}
                    </p>
                    {review.ownerResponse ? (
                      <div className="status-card">
                        <strong>Owner response</strong>
                        <p>{review.ownerResponse}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="form-stack">
                    <span className="status-badge">{review.status}</span>
                    <div className="queue-actions">
                      {moderationActions.map((action) => (
                        <button
                          className={action.status === 'HIDDEN' ? 'button button-secondary' : 'button button-primary'}
                          disabled={savingId === review.id || review.status === action.status}
                          key={action.status}
                          type="button"
                          onClick={() => void updateStatus(review, action.status)}
                        >
                          {savingId === review.id ? 'Saving…' : action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </PermissionGate>
  );
}
