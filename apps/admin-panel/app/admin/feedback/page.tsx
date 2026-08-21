'use client';

import { useEffect, useMemo, useState } from 'react';

import { listAdminReviews, moderateAdminReview } from '../../../src/api/admin-reviews-api';
import type { Review, ReviewStatus } from '@tuljai/types';

export default function FeedbackPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<ReviewStatus | undefined>();

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await listAdminReviews(status);
      setReviews(response.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load feedback.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [status]);

  const average = useMemo(() => reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0, [reviews]);
  const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

  async function moderate(id: string, nextStatus: ReviewStatus) {
    try {
      await moderateAdminReview(id, nextStatus);
      await load();
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : 'Could not update feedback.');
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div><p className="eyebrow">Guest experience</p><h2>Feedback & Ratings</h2><p>Review verified stay feedback, ratings and moderation status.</p></div>
      </div>
      <div className="metric-grid">
        <div className="metric-card"><span>Total shown</span><strong>{reviews.length}</strong></div>
        <div className="metric-card"><span>Average rating</span><strong>{average ? average.toFixed(1) : '—'} / 5</strong></div>
        <div className="metric-card"><span>5-star reviews</span><strong>{reviews.filter((review) => review.rating === 5).length}</strong></div>
      </div>
      <div className="panel-card">
        <div className="panel-header">
          <div><h3>Guest reviews</h3><p>Feedback submitted after completed stays.</p></div>
          <select value={status ?? ''} onChange={(event) => setStatus((event.target.value || undefined) as ReviewStatus | undefined)}>
            <option value="">All statuses</option><option value="PUBLISHED">Published</option><option value="HIDDEN">Hidden</option><option value="REPORTED">Reported</option><option value="REJECTED">Rejected</option>
          </select>
        </div>
        {error ? <div className="alert alert-danger">{error}</div> : null}
        {loading ? <p>Loading feedback…</p> : reviews.length === 0 ? <p>No feedback found.</p> : (
          <div className="table-wrap"><table><thead><tr><th>Rating</th><th>Review</th><th>Lodge</th><th>Guest</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {reviews.map((review) => <tr key={review.id}><td><strong>{stars(review.rating)}</strong><br />{review.rating}/5</td><td>{review.comment || 'No written comment.'}</td><td>{review.lodgeId}</td><td>{review.pilgrimUserId}</td><td>{review.status}</td><td><div className="button-row"><button className="button button-secondary" disabled={review.status === 'PUBLISHED'} onClick={() => void moderate(review.id, 'PUBLISHED')}>Publish</button><button className="button button-secondary" disabled={review.status === 'HIDDEN'} onClick={() => void moderate(review.id, 'HIDDEN')}>Hide</button></div></td></tr>)}
          </tbody></table></div>
        )}
      </div>
    </div>
  );
}
