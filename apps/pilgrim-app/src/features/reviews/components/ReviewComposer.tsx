import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { createReview } from '../api/reviews-api';

interface ReviewComposerProps {
  bookingId: string;
  lodgeName: string;
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  t: (english: string, marathi: string) => string;
}

export function ReviewComposer({
  bookingId,
  lodgeName,
  visible,
  onClose,
  onSubmitted,
  t,
}: ReviewComposerProps) {
  const [rating, setRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [locationRating, setLocationRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setRating(0);
    setCleanlinessRating(0);
    setLocationRating(0);
    setServiceRating(0);
    setValueRating(0);
    setTitle('');
    setComment('');
  }

  async function submit() {
    if (rating < 1) {
      Alert.alert(t('Rating required', 'रेटिंग आवश्यक आहे'), t('Please select a star rating.', 'कृपया स्टार रेटिंग निवडा.'));
      return;
    }

    setSubmitting(true);
    try {
      await createReview({
        bookingId,
        rating,
        cleanlinessRating: cleanlinessRating || undefined,
        locationRating: locationRating || undefined,
        serviceRating: serviceRating || undefined,
        valueRating: valueRating || undefined,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      reset();
      onSubmitted();
      onClose();
      Alert.alert(t('Thank you!', 'धन्यवाद!'), t('Your verified-stay review has been submitted.', 'तुमचा सत्यापित निवास अभिप्राय पाठवला आहे.'));
    } catch (error) {
      Alert.alert(
        t('Could not submit review', 'अभिप्राय पाठवता आला नाही'),
        error instanceof Error ? error.message : t('Please try again.', 'कृपया पुन्हा प्रयत्न करा.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View className="flex-1 justify-end bg-black/45">
        <View className="max-h-[92%] rounded-t-3xl bg-white px-5 pb-8 pt-4">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-xl font-extrabold text-warm-900">{t('How was your stay?', 'तुमचा निवास कसा होता?')}</Text>
              <Text className="mt-1 text-sm text-warm-500">{lodgeName}</Text>
            </View>
            <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-warm-100" onPress={onClose}>
              <MaterialCommunityIcons color="#2B2320" name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <RatingPicker label={t('Overall rating', 'एकूण रेटिंग')} rating={rating} setRating={setRating} large />
            <RatingPicker label={t('Cleanliness', 'स्वच्छता')} rating={cleanlinessRating} setRating={setCleanlinessRating} />
            <RatingPicker label={t('Location', 'ठिकाण')} rating={locationRating} setRating={setLocationRating} />
            <RatingPicker label={t('Service', 'सेवा')} rating={serviceRating} setRating={setServiceRating} />
            <RatingPicker label={t('Value for money', 'किमतीच्या मानाने मूल्य')} rating={valueRating} setRating={setValueRating} />
            <TextInput
              className="mt-3 rounded-2xl border border-warm-200 bg-warm-50 px-4 py-3 text-base text-warm-900"
              onChangeText={setTitle}
              placeholder={t('Review title (optional)', 'अभिप्राय शीर्षक (ऐच्छिक)')}
              placeholderTextColor="#817267"
              value={title}
            />
            <TextInput
              className="mt-3 min-h-28 rounded-2xl border border-warm-200 bg-warm-50 px-4 py-3 text-base text-warm-900"
              multiline
              onChangeText={setComment}
              placeholder={t('Tell other pilgrims about your stay (optional)', 'इतर भाविकांना तुमच्या निवासाबद्दल सांगा (ऐच्छिक)')}
              placeholderTextColor="#817267"
              textAlignVertical="top"
              value={comment}
            />
            <Pressable
              className={`mt-5 min-h-14 items-center justify-center rounded-2xl px-5 ${rating > 0 && !submitting ? 'bg-maroon-700' : 'bg-warm-200'}`}
              disabled={rating < 1 || submitting}
              onPress={() => void submit()}
            >
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text className={`text-base font-extrabold ${rating > 0 ? 'text-white' : 'text-warm-400'}`}>{t('Submit review', 'अभिप्राय पाठवा')}</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RatingPicker({
  label,
  rating,
  setRating,
  large = false,
}: {
  label: string;
  rating: number;
  setRating: (value: number) => void;
  large?: boolean;
}) {
  return (
    <View className="mb-4 rounded-2xl bg-warm-50 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-extrabold text-warm-800">{label}</Text>
        <View className="flex-row">
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable className="px-1" key={value} hitSlop={4} onPress={() => setRating(value)}>
              <MaterialCommunityIcons color="#E67E22" name={value <= rating ? 'star' : 'star-outline'} size={large ? 32 : 24} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
