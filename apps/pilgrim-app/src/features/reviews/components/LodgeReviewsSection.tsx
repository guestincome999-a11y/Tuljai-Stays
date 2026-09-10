import type { Review } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { EmptyState, Rating, SecondaryButton, ui } from '../../../pilgrim-ui/components';
import { FeedbackPrompt } from '../../../pilgrim-ui/components/FeedbackPrompt';
import { usePilgrimApp } from '../../../pilgrim-ui/PilgrimAppProvider';
import { getBookingReview, listLodgeReviews } from '../api/reviews-api';

/**
 * Reviews & Ratings block rendered directly on the lodge detail screen,
 * below the lodge information. Shows the live average rating and published
 * reviews for this lodge, and (for a pilgrim with a completed, not-yet-
 * reviewed stay here) a "Write a review" entry point for anyone who skipped
 * the post-checkout feedback popup.
 */
export function LodgeReviewsSection({ lodgeId }: { lodgeId: string }) {
  const { bookings, t } = usePilgrimApp();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewableBookingId, setReviewableBookingId] = useState<string | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await listLodgeReviews(lodgeId);
      setReviews(result.items);
      setTotalCount(result.totalItems);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('Could not load reviews.', 'अभिप्राय लोड करता आले नाहीत.'),
      );
    } finally {
      setLoading(false);
    }
  }, [lodgeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Most recently checked-out stays at this lodge first, so if the pilgrim
  // has more than one completed stay here the newest un-reviewed one wins.
  const completedStays = useMemo(
    () =>
      bookings
        .filter((booking) => booking.lodgeId === lodgeId && booking.status === 'completed')
        .sort((a, b) => (a.checkOutDate < b.checkOutDate ? 1 : -1)),
    [bookings, lodgeId],
  );

  useEffect(() => {
    let cancelled = false;
    if (completedStays.length === 0) {
      setReviewableBookingId(null);
      return undefined;
    }
    (async () => {
      for (const stay of completedStays) {
        try {
          const existing = await getBookingReview(stay.id);
          if (cancelled) return;
          if (!existing) {
            setReviewableBookingId(stay.id);
            return;
          }
        } catch {
          // Could not confirm this booking's review status; try the next one
          // rather than blocking the whole check.
        }
      }
      if (!cancelled) setReviewableBookingId(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [completedStays]);

  // Computed from the currently loaded page of published reviews (most
  // recent 50) rather than the lodge summary's static rating, so this
  // number reflects real submitted feedback.
  const averageRating = useMemo(() => {
    if (reviews.length === 0) return null;
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [reviews]);

  return (
    <View className="border-t border-warm-100 pt-6">
      <Text className="text-xl font-extrabold text-warm-900">
        {t('Reviews & ratings', 'अभिप्राय आणि रेटिंग')}
      </Text>

      <View className="mt-4 flex-row items-center gap-4 rounded-3xl border border-warm-100 bg-white p-5">
        <Text className="text-4xl font-extrabold text-warm-900">
          {averageRating !== null ? averageRating.toFixed(1) : '—'}
        </Text>
        <View>
          <Rating rating={averageRating ?? 0} />
          <Text className="mt-1.5 text-sm font-semibold text-warm-500">
            {totalCount} {t('pilgrim reviews', 'भाविक अभिप्राय')}
          </Text>
        </View>
      </View>

      {reviewableBookingId ? (
        <SecondaryButton className="mt-4 self-start" onPress={() => setPromptVisible(true)}>
          {t('Write a review', 'अभिप्राय लिहा')}
        </SecondaryButton>
      ) : null}

      {error ? (
        <View className="mt-4 rounded-2xl border border-danger-100 bg-danger-50 p-4">
          <Text className="font-semibold text-danger-700">{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="mt-4 items-center rounded-3xl border border-warm-100 bg-white py-10">
          <ActivityIndicator color={ui.saffronDeep} />
        </View>
      ) : null}

      {!loading && reviews.length === 0 && !error ? (
        <View className="mt-4">
          <EmptyState
            body={t(
              'No published reviews are available for this lodge yet.',
              'या लॉजसाठी अद्याप प्रकाशित अभिप्राय उपलब्ध नाहीत.',
            )}
            icon="star-outline"
            title={t('No reviews yet', 'अद्याप अभिप्राय नाहीत')}
          />
        </View>
      ) : null}

      {!loading
        ? reviews.map((review) => (
            <View className="mt-4 rounded-3xl border border-warm-100 bg-white p-5" key={review.id}>
              <View className="flex-row items-center justify-between gap-3">
                <Rating rating={review.rating} />
                {review.isVerifiedStay ? (
                  <View className="rounded-full bg-saffron-50 px-3 py-1.5">
                    <Text className="text-xs font-extrabold text-saffron-700">
                      ✓ {t('Verified stay', 'सत्यापित निवास')}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-3 text-base font-extrabold text-warm-900">
                {review.title ?? t('Guest review', 'पाहुण्यांचा अभिप्राय')}
              </Text>
              <Text className="mt-2 text-sm leading-6 text-warm-600">
                {review.comment ?? t('No written comment.', 'लिखित अभिप्राय नाही.')}
              </Text>
              {review.ownerResponse ? (
                <View className="mt-4 rounded-2xl border border-saffron-100 bg-saffron-50 p-4">
                  <Text className="text-xs font-extrabold uppercase tracking-wide text-maroon-700">
                    {t('Lodge owner reply', 'लॉज मालकाचे उत्तर')}
                  </Text>
                  <Text className="mt-2 text-sm leading-6 text-warm-700">
                    {review.ownerResponse}
                  </Text>
                </View>
              ) : null}
            </View>
          ))
        : null}

      {promptVisible && reviewableBookingId ? (
        <FeedbackPrompt
          bookingId={reviewableBookingId}
          onClose={() => {
            setPromptVisible(false);
            setReviewableBookingId(null);
            void load();
          }}
        />
      ) : null}
    </View>
  );
}
