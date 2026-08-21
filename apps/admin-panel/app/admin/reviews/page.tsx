'use client';

import type { Review, ReviewStatus } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { listAdminReviews, moderateAdminReview } from '../../../src/api/admin-reviews-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

const statuses: ReviewStatus[] = ['PUBLISHED', 'HIDDEN', 'REJECTED'];

export default function ReviewModerationPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listAdminReviews();
      setReviews(response.items);
    } catch {
      setMessage('Could not load reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateStatus(review: Review, status: ReviewStatus) {
    try {
      const updated = await moderateAdminReview(review.id, status);
      setReviews((items) => items.map((item) => item.id === updated.id ? updated : item));
      setMessage('Review status updated.');
    } catch {
      setMessage('Could not update this review.');
    }
  }

  return (
    <PermissionGate permission="reviews.manage">
      <section className="page-stack">
        <div className="page-heading"><div><p className="eyebrow">Trust & safety</p><h2>Review moderation</h2><p className="muted-copy">Publish, hide, or reject verified-stay reviews reported by pilgrims.</p></div></div>
        {message ? <p className="success-banner">{message}</p> : null}
        <div className="panel">
          {loading ? <p>Loading reviews…</p> : null}
          {!loading && reviews.length === 0 ? <p className="muted-copy">No reviews require moderation.</p> : null}
          <div className="admin-table">
            {reviews.map((review) => (
              <article className="admin-table-row" key={review.id}>
                <div><strong>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong><p>{review.title ?? 'Pilgrim review'}</p><p className="muted-copy">{review.comment ?? 'No written comment'} · {new Date(review.createdAt).toLocaleDateString('en-IN')}</p></div>
                <div><span className="status-badge">{review.status}</span><select aria-label="Review status" onChange={(event) => void updateStatus(review, event.target.value as ReviewStatus)} value={review.status}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PermissionGate>
  );
}
