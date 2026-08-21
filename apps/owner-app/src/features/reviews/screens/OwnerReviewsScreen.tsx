import type { Review } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { useOwnerApp } from '../../../owner-ui/OwnerAppProvider';
import { listOwnerReviews, respondToReview } from '../api/owner-reviews-api';

export function OwnerReviewsScreen() {
  const theme = useTheme();
  const { tr } = useOwnerApp();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listOwnerReviews();
      setReviews(result.items);
      setResponses(Object.fromEntries(result.items.map((review) => [review.id, review.ownerResponse ?? ''])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : tr('Could not load reviews'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(review: Review) {
    const response = (responses[review.id] ?? '').trim();
    if (response.length < 2) {
      setError(tr('Response must contain at least 2 characters'));
      return;
    }
    if (response.length > 2000) {
      setError(tr('Response must be 2000 characters or fewer'));
      return;
    }

    setSavingId(review.id);
    setError('');
    try {
      const updated = await respondToReview(review.id, response);
      setReviews((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setResponses((items) => ({ ...items, [updated.id]: updated.ownerResponse ?? response }));
      setMessage(tr('Owner response saved'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : tr('Could not save response'));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
        <Text>{tr('Loading reviews')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall">{tr('Guest Reviews')}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          {tr('Read guest feedback and reply as the lodge owner.')}
        </Text>

        {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : null}
        {reviews.length === 0 ? (
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{tr('No reviews yet')}</Text>
              <Text variant="bodyMedium">{tr('Published guest reviews for your assigned lodge will appear here.')}</Text>
            </Card.Content>
          </Card>
        ) : null}

        {reviews.map((review) => (
          <Card key={review.id} mode="outlined" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text style={{ color: theme.colors.primary }} variant="titleMedium">
                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
              </Text>
              <Text variant="titleMedium">{review.title ?? tr('Guest review')}</Text>
              <Text variant="bodyMedium">{review.comment ?? tr('No written comment.')}</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
                {review.isVerifiedStay ? tr('Verified stay') : tr('Stay not verified')}
              </Text>

              <TextInput
                disabled={savingId === review.id}
                label={tr('Owner response')}
                maxLength={2000}
                mode="outlined"
                multiline
                onChangeText={(text) => setResponses((items) => ({ ...items, [review.id]: text }))}
                value={responses[review.id] ?? ''}
              />
              <Button
                disabled={savingId === review.id || (responses[review.id] ?? '').trim().length < 2}
                loading={savingId === review.id}
                mode="contained"
                onPress={() => void save(review)}
              >
                {review.ownerResponse ? tr('Update response') : tr('Reply to guest')}
              </Button>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2500}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  container: { flex: 1 },
  content: { gap: 16, padding: 16, paddingBottom: 40 },
  card: { borderRadius: 18 },
  cardContent: { gap: 10 },
});
