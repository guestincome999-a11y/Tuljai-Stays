import type { PaginatedResponse, Review } from '@tuljai/types';
import { StyleSheet, View } from 'react-native';

import { api } from '../../core/api';
import { useCachedFetch } from '../../core/useCachedFetch';
import { useColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { detailStrings } from '../../i18n/strings';
import { Icon } from '../../ui/Icon';
import { Text } from '../../ui/Text';

const REVIEW_PREVIEW_COUNT = 3;

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ReviewList({ lodgeId }: { lodgeId: string }) {
  const colors = useColors();
  const { t } = useLang();
  const { data } = useCachedFetch(`reviews:${lodgeId}`, () =>
    api.get<PaginatedResponse<Review>>(`/lodges/${lodgeId}/reviews`, {
      params: { limit: REVIEW_PREVIEW_COUNT, page: 1 },
    }),
  );
  const reviews = data?.items ?? [];

  if (data && reviews.length === 0) {
    return (
      <Text color="inkMuted" variant="label">
        {t(detailStrings.noReviews)}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {reviews.map((review) => (
        <View key={review.id} style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.top}>
            <View style={styles.stars}>
              <Icon color="star" name="star" size={14} />
              <Text variant="label">{review.rating}</Text>
            </View>
            <Text color="inkFaint" variant="caption">
              {formatDate(review.createdAt)}
            </Text>
          </View>
          {review.comment ? <Text>{review.comment}</Text> : null}
          {review.ownerResponse ? (
            <View style={[styles.reply, { backgroundColor: colors.primarySoft }]}>
              <Text color="primary" variant="caption">
                {t(detailStrings.ownerReply)}
              </Text>
              <Text variant="caption">{review.ownerResponse}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, gap: space.sm, padding: space.lg },
  list: { gap: space.md },
  reply: { borderRadius: radius.md, gap: 2, padding: space.md },
  stars: { alignItems: 'center', flexDirection: 'row', gap: space.xs },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
