import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fetchBookingReview, submitReview } from '../../core/reviews';
import { refreshAllCached, useCachedFetch } from '../../core/useCachedFetch';
import { useColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { extraStrings } from '../../i18n/extraStrings';
import { useLang } from '../../i18n/language';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';
import { FormField } from '../booking/FormField';

/** Lets a guest rate a finished stay once. Shows their review afterwards. */
export function ReviewCard({ bookingId }: { bookingId: string }) {
  const colors = useColors();
  const { t } = useLang();
  const { data: existing } = useCachedFetch(`review:${bookingId}`, () =>
    fetchBookingReview(bookingId),
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) return;
    setSaving(true);
    setError(null);
    try {
      await submitReview({ bookingId, comment, rating });
      await refreshAllCached();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(extraStrings.somethingWrong));
    } finally {
      setSaving(false);
    }
  }

  if (existing === undefined) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {existing ? (
        <>
          <Text variant="heading">{t(extraStrings.reviewDone)}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Icon
                color={value <= existing.rating ? 'star' : 'inkFaint'}
                key={value}
                name="star"
                size={22}
              />
            ))}
          </View>
          {existing.comment ? <Text color="inkMuted">{existing.comment}</Text> : null}
        </>
      ) : (
        <>
          <Text variant="heading">{t(extraStrings.reviewTitle)}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <PressableScale
                accessibilityLabel={`${value}`}
                hitSlop={space.sm}
                key={value}
                pressedScale={0.85}
                onPress={() => setRating(value)}
              >
                <Icon color={value <= rating ? 'star' : 'inkFaint'} name="star" size={30} />
              </PressableScale>
            ))}
          </View>
          <FormField
            label={t(extraStrings.reviewComment)}
            multiline
            value={comment}
            onChangeText={setComment}
          />
          {error ? (
            <Text color="danger" variant="caption">
              {error}
            </Text>
          ) : null}
          <Button
            disabled={rating < 1}
            label={t(extraStrings.reviewSubmit)}
            loading={saving}
            onPress={() => void submit()}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, gap: space.md, padding: space.lg },
  stars: { flexDirection: 'row', gap: space.sm },
});
