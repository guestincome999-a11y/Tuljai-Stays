import type { Review } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AppScreen, EmptyState, Rating, ui } from '../../../pilgrim-ui/components';
import { usePilgrimApp } from '../../../pilgrim-ui/PilgrimAppProvider';
import { listLodgeReviews } from '../api/reviews-api';

export function PilgrimReviewsScreen() {
  const { lodges, t } = usePilgrimApp();
  const [selectedLodgeId, setSelectedLodgeId] = useState<string | null>(lodges[0]?.id ?? null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const selectedLodge = useMemo(
    () => lodges.find((lodge) => lodge.id === selectedLodgeId) ?? lodges[0],
    [lodges, selectedLodgeId],
  );
  const load = useCallback(
    async (isRefresh = false) => {
      if (!selectedLodge) return;
      setError('');
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await listLodgeReviews(selectedLodge.id);
        setReviews(result.items);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t('Could not load reviews.', 'अभिप्राय लोड करता आले नाहीत.'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedLodge, t],
  );
  useEffect(() => {
    if (selectedLodge && selectedLodge.id !== selectedLodgeId) {
      setSelectedLodgeId(selectedLodge.id);
      return;
    }
    void load();
  }, [load, selectedLodge, selectedLodgeId]);
  return (
    <AppScreen padded scroll={false}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 pb-8"
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={ui.saffronDeep}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-2xl font-extrabold text-warm-900">
            {t('Guest reviews', 'भाविकांचे अभिप्राय')}
          </Text>
          <Text className="mt-1 text-sm leading-5 text-warm-500">
            {t(
              'See verified guest experiences and lodge-owner replies.',
              'सत्यापित पाहुण्यांचे अनुभव आणि लॉज मालकांची उत्तरे पहा.',
            )}
          </Text>
        </View>
        {lodges.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
          >
            {lodges.map((lodge) => (
              <Pressable
                className={`rounded-full border px-4 py-2.5 ${selectedLodge?.id === lodge.id ? 'border-maroon-700 bg-maroon-700' : 'border-warm-200 bg-white'}`}
                key={lodge.id}
                onPress={() => setSelectedLodgeId(lodge.id)}
              >
                <Text
                  className={`text-sm font-extrabold ${selectedLodge?.id === lodge.id ? 'text-white' : 'text-warm-700'}`}
                >
                  {lodge.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {error ? (
          <View className="rounded-2xl border border-danger-100 bg-danger-50 p-4">
            <Text className="font-semibold text-danger-700">{error}</Text>
            <Pressable
              className="mt-3 self-start rounded-xl bg-maroon-700 px-4 py-2"
              onPress={() => void load()}
            >
              <Text className="font-extrabold text-white">{t('Retry', 'पुन्हा प्रयत्न')}</Text>
            </Pressable>
          </View>
        ) : null}
        {loading ? (
          <View className="items-center rounded-3xl border border-warm-100 bg-white py-12">
            <ActivityIndicator color={ui.saffronDeep} />
            <Text className="mt-3 text-sm font-semibold text-warm-500">
              {t('Loading reviews…', 'अभिप्राय लोड होत आहेत…')}
            </Text>
          </View>
        ) : null}
        {!loading && reviews.length === 0 ? (
          <EmptyState
            body={t(
              'No published reviews are available for this lodge yet.',
              'या लॉजसाठी अद्याप प्रकाशित अभिप्राय उपलब्ध नाहीत.',
            )}
            icon="star-outline"
            title={t('No reviews yet', 'अद्याप अभिप्राय नाहीत')}
          />
        ) : null}
        {!loading
          ? reviews.map((review) => (
              <View className="rounded-3xl border border-warm-100 bg-white p-5" key={review.id}>
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
                    {review.ownerResponseAt ? (
                      <Text className="mt-2 text-xs text-warm-500">
                        {new Date(review.ownerResponseAt).toLocaleDateString('en-IN')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))
          : null}
      </ScrollView>
    </AppScreen>
  );
}
