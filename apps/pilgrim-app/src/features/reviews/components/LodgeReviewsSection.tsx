import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import type { Review } from '@tuljai/types';

import { listLodgeReviews, reportReview } from '../api/reviews-api';

interface LodgeReviewsSectionProps { lodgeId: string; t: (english: string, marathi: string) => string; }

export function LodgeReviewsSection({ lodgeId, t }: LodgeReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true); setPage(1);
    void listLodgeReviews(lodgeId, 1, 5).then((response) => { if (active) { setReviews(response.items); setTotalItems(response.totalItems); } }).catch(() => { if (active) setReviews([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lodgeId]);

  async function loadMore() {
    if (loadingMore || reviews.length >= totalItems) return;
    setLoadingMore(true);
    try { const nextPage = page + 1; const response = await listLodgeReviews(lodgeId, nextPage, 5); setReviews((current) => [...current, ...response.items]); setTotalItems(response.totalItems); setPage(nextPage); } finally { setLoadingMore(false); }
  }

  async function report(id: string) {
    try { await reportReview(id, 'OTHER', 'Reported by pilgrim from lodge reviews'); Alert.alert(t('Report submitted', 'तक्रार पाठवली'), t('Thank you. Our team will review this content.', 'धन्यवाद. आमची टीम हा अभिप्राय तपासेल.')); }
    catch { Alert.alert(t('Could not report review', 'अभिप्राय रिपोर्ट करता आला नाही'), t('Please try again.', 'कृपया पुन्हा प्रयत्न करा.')); }
  }

  return <View className="border-t border-warm-100 pt-6">
    <View className="flex-row items-end justify-between"><View className="flex-1"><Text className="text-xl font-extrabold text-warm-900">{t('Pilgrim reviews', 'भाविकांचे अभिप्राय')}</Text><Text className="mt-1 text-sm text-warm-500">{totalItems} {t('verified-stay reviews', 'सत्यापित निवास अभिप्राय')}</Text></View></View>
    {loading ? <View className="items-center py-8"><ActivityIndicator color="#C96818" /></View> : reviews.length === 0 ? <View className="mt-4 rounded-2xl bg-warm-50 px-4 py-6"><Text className="text-center text-sm font-semibold text-warm-500">{t('No reviews yet. Be the first pilgrim to share your experience.', 'अजून अभिप्राय नाही. तुमचा अनुभव शेअर करणारे पहिले भाविक व्हा.')}</Text></View> : <View className="mt-4 gap-3">
      {reviews.map((review) => <View className="rounded-2xl border border-warm-100 bg-white p-4" key={review.id}>
        <View className="flex-row items-start justify-between gap-3"><View className="flex-1"><View className="flex-row items-center gap-1">{[1, 2, 3, 4, 5].map((star) => <MaterialCommunityIcons color="#E67E22" key={star} name={star <= review.rating ? 'star' : 'star-outline'} size={17} />)}</View><Text className="mt-2 text-sm font-extrabold text-warm-900">{review.title ?? t('Pilgrim review', 'भाविक अभिप्राय')}</Text></View><Pressable className="h-9 w-9 items-center justify-center rounded-full bg-warm-50" onPress={() => void report(review.id)}><MaterialCommunityIcons color="#817267" name="flag-outline" size={18} /></Pressable></View>
        {review.comment ? <Text className="mt-2 text-sm leading-5 text-warm-600">{review.comment}</Text> : null}
        <View className="mt-3 flex-row items-center gap-2"><MaterialCommunityIcons color="#4A7C59" name="check-decagram" size={16} /><Text className="text-xs font-bold text-templeGreen-700">{t('Verified stay', 'सत्यापित निवास')}</Text><Text className="text-xs text-warm-400">• {new Date(review.createdAt).toLocaleDateString()}</Text></View>
      </View>)}
      {reviews.length < totalItems ? <Pressable className="min-h-12 items-center justify-center rounded-2xl border border-warm-200 bg-white" disabled={loadingMore} onPress={() => void loadMore()}>{loadingMore ? <ActivityIndicator color="#C96818" /> : <Text className="text-sm font-extrabold text-maroon-700">{t('Load more reviews', 'आणखी अभिप्राय पहा')}</Text>}</Pressable> : null}
    </View>}
  </View>;
}
