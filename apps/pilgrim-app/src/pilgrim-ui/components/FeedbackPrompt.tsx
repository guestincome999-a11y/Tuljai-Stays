import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { submitReview } from '../../features/reviews/api/reviews-api';
import { ui } from '../components';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function FeedbackPrompt({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { t } = usePilgrimApp();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (rating < 1 || rating > 5) {
      setError(t('Please select a rating from 1 to 5 stars.', 'कृपया १ ते ५ स्टार रेटिंग निवडा.'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitReview({ bookingId, rating, comment });
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t('Could not submit feedback. Please try again.', 'अभिप्राय पाठवता आला नाही. कृपया पुन्हा प्रयत्न करा.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white px-5 pb-8 pt-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-2xl font-extrabold text-warm-900">
                {t('How was your stay?', 'तुमचा मुक्काम कसा होता?')}
              </Text>
              <Text className="mt-1 text-sm leading-5 text-warm-500">
                {t(
                  'Your feedback helps us improve Tuljai Stays and our partner lodges.',
                  'तुमचा अभिप्राय तुळजाई स्टेज आणि आमच्या भागीदार लॉजमध्ये सुधारणा करण्यास मदत करतो.',
                )}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={t('Close feedback', 'अभिप्राय बंद करा')}
              className="h-10 w-10 items-center justify-center rounded-full bg-warm-100"
              onPress={onClose}
            >
              <MaterialCommunityIcons color={ui.ink} name="close" size={22} />
            </Pressable>
          </View>

          <View className="mt-6 flex-row justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                onPress={() => setRating(value)}
              >
                <MaterialCommunityIcons
                  color={value <= rating ? ui.saffronDeep : ui.muted}
                  name={value <= rating ? 'star' : 'star-outline'}
                  size={42}
                />
              </Pressable>
            ))}
          </View>
          <Text className="mt-2 text-center text-sm font-bold text-warm-600">
            {rating ? `${rating}/5` : t('Tap a star to rate', 'रेटिंगसाठी स्टारवर टॅप करा')}
          </Text>

          <TextInput
            className="mt-6 min-h-28 rounded-2xl border border-warm-200 bg-warm-50 px-4 py-3 text-base text-warm-900"
            editable={!submitting}
            multiline
            maxLength={2000}
            onChangeText={setComment}
            placeholder={t('Tell us about your experience (optional)', 'तुमचा अनुभव सांगा (ऐच्छिक)')}
            placeholderTextColor={ui.muted}
            textAlignVertical="top"
            value={comment}
          />
          {error ? (
            <Text className="mt-3 text-sm font-semibold text-danger-700">{error}</Text>
          ) : null}

          <View className="mt-5 flex-row gap-3">
            <Pressable
              className="min-h-14 flex-1 items-center justify-center rounded-2xl bg-warm-100"
              disabled={submitting}
              onPress={onClose}
            >
              <Text className="font-extrabold text-warm-700">{t('Not now', 'आत्ता नाही')}</Text>
            </Pressable>
            <Pressable
              className="min-h-14 flex-1 items-center justify-center rounded-2xl bg-maroon-700"
              disabled={submitting}
              onPress={() => void submit()}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-extrabold text-white">
                  {t('Submit feedback', 'अभिप्राय पाठवा')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
