import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BookingGuestIdProofUpload } from '@tuljai/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';

import { useAuth } from '../../auth/auth-context';
import {
  cancelBooking,
  createRazorpayOrder,
  uploadGuestIdProof,
  verifyRazorpayPayment,
  type GuestIdProofFile,
} from '../../features/bookings/api/bookings-api';
import {
  AnimatedResultBadge,
  AppScreen,
  EmptyState,
  Field,
  PrimaryButton,
  TopBar,
  ui,
} from '../components';
import { formatRupees } from '../mock-data';
import { usePilgrimApp } from '../PilgrimAppProvider';

const allowedIdProofTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const maxIdProofSizeBytes = 5 * 1024 * 1024;
type PaymentMethod = 'ONLINE' | 'PAY_AT_LODGE';
type Step = 1 | 2 | 3;

export function PilgrimCheckoutScreen() {
  const params = useLocalSearchParams<{ lodgeId?: string; roomTypeId?: string }>();
  const router = useRouter();
  const auth = useAuth();
  const { createBooking, lodges, t } = usePilgrimApp();
  const lodge = lodges.find((item) => item.id === params.lodgeId);
  const initialRoom = lodge?.rooms.find((item) => item.id === params.roomTypeId) ?? lodge?.rooms[0];

  const [step, setStep] = useState<Step>(1);
  const [roomId, setRoomId] = useState(initialRoom?.id ?? '');
  const [checkInDate, setCheckInDate] = useState(toDateOnly(addDays(startOfToday(), 1)));
  const [checkOutDate, setCheckOutDate] = useState(toDateOnly(addDays(startOfToday(), 2)));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [name, setName] = useState(auth.user?.displayName?.trim() ?? '');
  const [phone, setPhone] = useState(auth.user?.phoneNumber?.replace(/\D/gu, '').slice(-10) ?? '');
  const [email, setEmail] = useState('');
  const [guestIdProof, setGuestIdProof] = useState<GuestIdProofFile | null>(null);
  // The ID proof uploads to the backend the moment it's picked (see pickGuestIdProof)
  // instead of at the final "Pay" press, so nothing is waiting on a multipart upload
  // when the guest actually taps to pay. `uploadedIdProof` holds the server-confirmed
  // storage descriptor that booking creation needs; `idProofUploading` drives the
  // in-progress indicator on the picker.
  const [uploadedIdProof, setUploadedIdProof] = useState<BookingGuestIdProofUpload | null>(null);
  const [idProofUploading, setIdProofUploading] = useState(false);
  const [request, setRequest] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PAY_AT_LODGE');
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentFailure, setPaymentFailure] = useState<string | null>(null);
  const documentPickerActiveRef = useRef(false);

  const room = lodge?.rooms.find((item) => item.id === roomId) ?? lodge?.rooms[0];
  const checkInOptions = useMemo(() => buildDateOptions(startOfToday(), 60), []);
  const checkoutOptions = useMemo(
    () => buildDateOptions(addDays(parseDateOnly(checkInDate), 1), 60),
    [checkInDate],
  );
  const nights = Math.max(daysBetween(checkInDate, checkOutDate), 1);
  const subtotal = (room?.price ?? 0) * nights;
  const taxes = Math.round(subtotal * 0.05);
  const total = subtotal + taxes;

  function validateGuestDetails(): boolean {
    if (!name.trim() || phone.replace(/\D/gu, '').length !== 10) {
      Alert.alert(
        t('Check guest details', 'पाहुण्यांची माहिती तपासा'),
        t(
          'Enter a name and valid 10-digit mobile number.',
          'नाव आणि वैध १० अंकी मोबाइल क्रमांक टाका.',
        ),
      );
      return false;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/u.test(email.trim())) {
      Alert.alert(
        t('Check email address', 'ईमेल पत्ता तपासा'),
        t('Enter a valid email or leave it blank.', 'वैध ईमेल टाका किंवा रिकामा ठेवा.'),
      );
      return false;
    }
    if (idProofUploading) {
      Alert.alert(
        t('ID proof uploading', 'ओळखपत्र अपलोड होत आहे'),
        t('Please wait a moment for the ID proof to finish uploading.', 'ओळखपत्र अपलोड होईपर्यंत थोडा वेळ थांबा.'),
      );
      return false;
    }
    if (!guestIdProof || !uploadedIdProof) {
      Alert.alert(
        t('Upload guest ID proof', 'पाहुण्याचे ओळखपत्र अपलोड करा'),
        t('A government photo ID proof is required.', 'सरकारी फोटो ओळखपत्र आवश्यक आहे.'),
      );
      return false;
    }
    return true;
  }

  function goToStep(target: Step) {
    if (target === 3 && !validateGuestDetails()) return;
    setStep(target);
  }

  function continueFlow() {
    if (step === 2 && !validateGuestDetails()) return;
    setStep((current) => Math.min(3, current + 1) as Step);
  }

  async function pickGuestIdProof() {
    if (documentPickerActiveRef.current) return;
    documentPickerActiveRef.current = true;
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: Platform.OS === 'android' ? '*/*' : [...allowedIdProofTypes],
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = resolveIdProofMimeType(asset.name, asset.mimeType);
      if (!mimeType)
        throw new Error(t('Choose a JPEG, PNG or PDF file.', 'JPEG, PNG किंवा PDF फाइल निवडा.'));
      const sizeBytes = asset.size ?? asset.file?.size;
      if (sizeBytes && sizeBytes > maxIdProofSizeBytes) {
        throw new Error(
          t('ID proof must be 5 MB or smaller.', 'ओळखपत्र ५ MB किंवा त्यापेक्षा कमी असावे.'),
        );
      }
      const picked: GuestIdProofFile = {
        mimeType,
        name: asset.name,
        sizeBytes,
        uri: asset.uri,
        webFile: asset.file,
      };
      setGuestIdProof(picked);
      setUploadedIdProof(null);
      // Upload right away instead of waiting for the "Pay" button press, so the
      // multipart upload round-trip is already done well before checkout.
      setIdProofUploading(true);
      try {
        const uploaded = await uploadGuestIdProof(picked);
        setUploadedIdProof(uploaded);
      } catch (uploadError) {
        setGuestIdProof(null);
        setUploadedIdProof(null);
        Alert.alert(
          t('ID proof', 'ओळखपत्र'),
          uploadError instanceof Error
            ? uploadError.message
            : t('Could not upload ID proof. Please try again.', 'ओळखपत्र अपलोड करता आले नाही. पुन्हा प्रयत्न करा.'),
        );
      } finally {
        setIdProofUploading(false);
      }
    } catch (error) {
      if (error instanceof Error) Alert.alert(t('ID proof', 'ओळखपत्र'), error.message);
    } finally {
      documentPickerActiveRef.current = false;
    }
  }

  async function confirmBooking() {
    if (!lodge || !room) {
      Alert.alert(
        t('Room unavailable', 'खोली उपलब्ध नाही'),
        t('Please choose another room.', 'कृपया दुसरी खोली निवडा.'),
      );
      return;
    }
    if (!validateGuestDetails() || !agree) {
      if (!agree) {
        Alert.alert(
          t('Accept booking terms', 'बुकिंग अटी स्वीकारा'),
          t(
            'Please accept the lodge rules and cancellation terms.',
            'लॉजचे नियम आणि रद्दीकरण अटी स्वीकारा.',
          ),
        );
      }
      setStep(3);
      return;
    }

    setSubmitting(true);
    setPaymentFailure(null);
    let bookingId: string | null = null;
    let paymentStarted = false;
    let paymentVerified = false;

    try {
      const booking = await createBooking({
        checkInDate,
        checkOutDate,
        checkoutDateFlexible: false,
        guestEmail: email.trim() || undefined,
        guestIdProof: uploadedIdProof!,
        guestName: name.trim(),
        guestPhone: phone,
        lodgeId: lodge.id,
        numberOfAdults: adults,
        numberOfChildren: children,
        paymentMethod,
        roomId: room.id,
        specialRequest: request.trim() || undefined,
      });
      bookingId = booking.id;

      if (paymentMethod === 'ONLINE') {
        const order = await createRazorpayOrder(booking.id);
        paymentStarted = true;
        const result = await RazorpayCheckout.open({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'Tuljai Stays',
          description: `${lodge.name} · ${room.name}`,
          prefill: {
            name: name.trim(),
            contact: phone.replace(/\D/gu, ''),
            email: email.trim() || undefined,
          },
          notes: { bookingId: booking.id },
          theme: { color: '#C2410C' },
        });
        const verified = await verifyRazorpayPayment(booking.id, {
          orderId: result.razorpay_order_id,
          paymentId: result.razorpay_payment_id,
          signature: result.razorpay_signature,
        });
        paymentVerified = verified.paymentStatus === 'PAID' && verified.status === 'ACCEPTED';
        if (!paymentVerified) {
          throw new Error(
            t(
              'Payment is being reconciled. Check your booking status shortly.',
              'पेमेंट पडताळले जात आहे. थोड्या वेळाने बुकिंग स्थिती तपासा.',
            ),
          );
        }
      }

      Alert.alert(
        paymentMethod === 'ONLINE'
          ? t('Payment successful', 'पेमेंट यशस्वी')
          : t('Booking request sent', 'बुकिंग विनंती पाठवली'),
        paymentMethod === 'ONLINE'
          ? t(
              'Your prepaid room is confirmed immediately. No lodge approval is required.',
              'तुमची प्रीपेड खोली त्वरित निश्चित झाली आहे. लॉजची मंजुरी आवश्यक नाही.',
            )
          : t(
              'The lodge owner will review your request before confirmation.',
              'पुष्टीकरणापूर्वी लॉज मालक तुमची विनंती तपासतील.',
            ),
      );
      router.replace({
        pathname: '/(app)/bookings/[id]',
        params: { id: booking.id, justBooked: '1' },
      });
    } catch (error) {
      if (bookingId && paymentMethod === 'ONLINE' && !paymentStarted && !paymentVerified) {
        await cancelBooking(bookingId, 'Razorpay order could not be started').catch(
          () => undefined,
        );
      }
      const message =
        error instanceof Error
          ? error.message
          : t('Please try again.', 'कृपया पुन्हा प्रयत्न करा.');
      setPaymentFailure(message);
      Alert.alert(t('Booking could not be completed', 'बुकिंग पूर्ण होऊ शकले नाही'), message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!lodge || !room) {
    return (
      <AppScreen className="gap-6 pt-1">
        <TopBar
          onBack={() => router.back()}
          title={t('Complete your booking', 'बुकिंग पूर्ण करा')}
        />
        <EmptyState
          action={t('Choose another stay', 'दुसरा निवास निवडा')}
          body={t(
            'This lodge has no bookable room right now.',
            'या लॉजमध्ये सध्या बुक करण्यायोग्य खोली नाही.',
          )}
          icon="bed-empty"
          onAction={() => router.replace('/(app)/lodges')}
          title={t('No room available', 'खोली उपलब्ध नाही')}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen className="gap-5 pt-1">
      <TopBar
        onBack={() =>
          step === 1 ? router.back() : setStep((current) => Math.max(1, current - 1) as Step)
        }
        subtitle={lodge.name}
        title={t('Complete your booking', 'बुकिंग पूर्ण करा')}
      />

      <CheckoutStepHeader step={step} t={t} onSelect={goToStep} />

      {step === 1 ? (
        <View className="gap-5">
          <SectionTitle title={t('Your stay', 'तुमचा निवास')} />
          <View className="rounded-3xl border border-warm-200 bg-white p-4">
            <Text className="text-lg font-extrabold text-warm-900">{lodge.name}</Text>
            <Text className="mt-1 text-sm text-warm-500">
              {room.name} · {room.bed} · {room.capacity}
            </Text>
          </View>
          <SectionTitle title={t('Select room', 'खोली निवडा')} />
          <View className="gap-3">
            {lodge.rooms.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setRoomId(item.id)}
                className={`rounded-3xl border bg-white p-4 ${roomId === item.id ? 'border-2 border-saffron-500' : 'border-warm-200'}`}
              >
                <View className="flex-row items-center gap-3">
                  <MaterialCommunityIcons
                    color={roomId === item.id ? ui.saffronDeep : ui.muted}
                    name={roomId === item.id ? 'radiobox-marked' : 'radiobox-blank'}
                    size={24}
                  />
                  <View className="flex-1">
                    <Text className="text-base font-extrabold text-warm-900">{item.name}</Text>
                    <Text className="mt-1 text-sm text-warm-500">
                      {item.bed} · {item.capacity}
                    </Text>
                    <Text className="mt-2 text-lg font-extrabold text-maroon-700">
                      {formatRupees(item.price)} / night
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
          <SectionTitle title={t('Choose dates', 'तारखा निवडा')} />
          <DateSelector
            label={t('Check-in', 'चेक-इन')}
            options={checkInOptions}
            selectedDate={checkInDate}
            onSelect={(value) => {
              setCheckInDate(value);
              if (checkOutDate <= value)
                setCheckOutDate(toDateOnly(addDays(parseDateOnly(value), 1)));
            }}
          />
          <DateSelector
            label={t('Checkout', 'चेक-आउट')}
            options={checkoutOptions}
            selectedDate={checkOutDate}
            onSelect={setCheckOutDate}
          />
          <GuestCounter
            label={t('Adults', 'प्रौढ')}
            value={adults}
            min={1}
            max={6}
            onChange={setAdults}
          />
          <GuestCounter
            label={t('Children', 'मुले')}
            value={children}
            min={0}
            max={6}
            onChange={setChildren}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View className="gap-5">
          <SectionTitle title={t('Guest details', 'पाहुण्यांची माहिती')} />
          <Text className="text-sm text-warm-500">
            {t(
              'Enter the lead guest exactly as shown on the ID proof.',
              'मुख्य पाहुण्याची माहिती ओळखपत्राप्रमाणे अचूक भरा.',
            )}
          </Text>
          <Field
            autoCapitalize="words"
            icon="account-outline"
            label={t('Full name', 'पूर्ण नाव')}
            onChangeText={setName}
            placeholder="As on photo ID"
            value={name}
          />
          <Field
            icon="phone-outline"
            keyboardType="phone-pad"
            label={t('Mobile number', 'मोबाइल क्रमांक')}
            maxLength={10}
            onChangeText={(value) => setPhone(value.replace(/\D/gu, ''))}
            placeholder="10-digit mobile number"
            value={phone}
          />
          <Field
            autoCapitalize="none"
            icon="email-outline"
            keyboardType="email-address"
            label={t('Email address', 'ईमेल पत्ता')}
            onChangeText={setEmail}
            placeholder="Optional"
            value={email}
          />
          <View className="gap-2">
            <Text className="text-sm font-bold text-warm-700">
              {t('Government ID proof', 'सरकारी ओळखपत्र')} *
            </Text>
            <Pressable
              onPress={() => void pickGuestIdProof()}
              className="min-h-28 items-center justify-center rounded-2xl border-2 border-dashed border-saffron-300 bg-saffron-50 px-5"
            >
              <MaterialCommunityIcons
                color={ui.saffronDeep}
                name={
                  idProofUploading
                    ? 'cloud-upload-outline'
                    : uploadedIdProof
                      ? 'file-check-outline'
                      : 'upload-outline'
                }
                size={26}
              />
              <Text className="mt-2 text-center text-sm font-extrabold text-maroon-700">
                {idProofUploading
                  ? t('Uploading…', 'अपलोड होत आहे…')
                  : (guestIdProof?.name ??
                    t(
                      'Upload JPEG, PNG or PDF · Max 5 MB',
                      'JPEG, PNG किंवा PDF अपलोड करा · कमाल ५ MB',
                    ))}
              </Text>
            </Pressable>
          </View>
          <Field
            icon="message-text-outline"
            label={t('Special request (optional)', 'विशेष विनंती (ऐच्छिक)')}
            multiline
            onChangeText={setRequest}
            placeholder={t('Any request for the lodge…', 'लॉजसाठी कोणतीही विनंती…')}
            value={request}
          />
        </View>
      ) : null}

      {step === 3 ? (
        <View className="gap-5">
          {paymentFailure ? (
            <View className="items-center rounded-3xl bg-danger-50 px-5 py-6">
              <AnimatedResultBadge tone="danger" />
              <Text className="mt-4 text-center text-lg font-extrabold text-danger-700">
                {t('Payment failed', 'पेमेंट अयशस्वी')}
              </Text>
              <Text className="mt-2 text-center text-sm leading-5 text-warm-600">
                {paymentFailure}
              </Text>
            </View>
          ) : null}
          <SectionTitle title={t('Review guest details', 'पाहुण्यांची माहिती तपासा')} />
          <Pressable
            onPress={() => setStep(2)}
            className="rounded-3xl border border-warm-200 bg-white p-5"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-saffron-50">
                <MaterialCommunityIcons
                  color={ui.saffronDeep}
                  name="account-check-outline"
                  size={24}
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-extrabold text-warm-900">
                  {name || t('Guest name', 'पाहुण्याचे नाव')}
                </Text>
                <Text className="mt-1 text-sm text-warm-500">
                  {phone || t('Mobile not entered', 'मोबाइल दिलेला नाही')}
                </Text>
                {email ? <Text className="mt-1 text-sm text-warm-500">{email}</Text> : null}
              </View>
              <Text className="font-extrabold text-saffron-700">{t('Edit', 'बदला')}</Text>
            </View>
            <View className="mt-4 border-t border-warm-100 pt-4">
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons color={ui.success} name="file-check-outline" size={18} />
                <Text className="text-sm font-semibold text-warm-700">{guestIdProof?.name}</Text>
              </View>
              {request ? (
                <Text className="mt-2 text-sm text-warm-500">
                  {t('Request:', 'विनंती:')} {request}
                </Text>
              ) : null}
            </View>
          </Pressable>

          <SectionTitle title={t('Choose payment', 'पेमेंट निवडा')} />
          <PaymentOption
            active={paymentMethod === 'ONLINE'}
            icon="qrcode-scan"
            label={t('Pay online', 'ऑनलाइन पेमेंट')}
            description={t(
              'UPI, cards and Razorpay · instant prepaid confirmation',
              'UPI, कार्ड आणि Razorpay · त्वरित प्रीपेड पुष्टीकरण',
            )}
            onPress={() => {
              setPaymentFailure(null);
              setPaymentMethod('ONLINE');
            }}
          />
          <PaymentOption
            active={paymentMethod === 'PAY_AT_LODGE'}
            icon="cash"
            label={t('Pay at the lodge', 'लॉजवर पैसे भरा')}
            description={t(
              'Owner approval is required before confirmation',
              'पुष्टीकरणापूर्वी लॉज मालकाची मंजुरी आवश्यक',
            )}
            onPress={() => {
              setPaymentFailure(null);
              setPaymentMethod('PAY_AT_LODGE');
            }}
          />
          <View className="rounded-3xl border border-warm-100 bg-white p-5">
            <Text className="text-lg font-extrabold text-warm-900">
              {t('Price details', 'किंमत तपशील')}
            </Text>
            <PriceRow
              label={`${formatRupees(room.price)} × ${nights} nights`}
              value={formatRupees(subtotal)}
            />
            <PriceRow
              label={t('Taxes and lodge charges', 'कर आणि लॉज शुल्क')}
              value={formatRupees(taxes)}
            />
            <View className="mt-4 flex-row items-center justify-between border-t border-warm-100 pt-4">
              <Text className="text-base font-extrabold text-warm-900">{t('Total', 'एकूण')}</Text>
              <Text className="text-2xl font-extrabold text-maroon-700">{formatRupees(total)}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setAgree((value) => !value)}
            className="flex-row items-start gap-3"
          >
            <MaterialCommunityIcons
              color={agree ? ui.saffronDeep : ui.muted}
              name={agree ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
            />
            <Text className="flex-1 text-sm leading-5 text-warm-600">
              {t(
                'I agree to the lodge rules, guest policy and cancellation terms.',
                'मी लॉजचे नियम, पाहुणे धोरण आणि रद्दीकरण अटी मान्य करतो/करते.',
              )}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step < 3 ? (
        <PrimaryButton icon="arrow-right" onPress={continueFlow}>
          {t('Continue', 'पुढे चला')}
        </PrimaryButton>
      ) : (
        <PrimaryButton
          icon={paymentMethod === 'ONLINE' ? 'lock-outline' : 'check-circle-outline'}
          loading={submitting}
          onPress={() => void confirmBooking()}
        >
          {paymentMethod === 'ONLINE'
            ? t(`Pay ${formatRupees(total)}`, `${formatRupees(total)} भरा`)
            : t('Confirm booking', 'बुकिंग निश्चित करा')}
        </PrimaryButton>
      )}
      <Text className="text-center text-xs text-warm-500">
        {paymentMethod === 'ONLINE'
          ? t(
              'Secure Razorpay checkout · prepaid bookings do not require owner approval',
              'सुरक्षित Razorpay पेमेंट · प्रीपेड बुकिंगला मालकाची मंजुरी आवश्यक नाही',
            )
          : t(
              'Your request will be sent to the lodge owner',
              'तुमची विनंती लॉज मालकाकडे पाठवली जाईल',
            )}
      </Text>
    </AppScreen>
  );
}

function CheckoutStepHeader({
  step,
  t,
  onSelect,
}: {
  step: Step;
  t: (english: string, marathi: string) => string;
  onSelect: (step: Step) => void;
}) {
  const items: Array<{
    step: Step;
    label: string;
    marathi: string;
    icon: 'bed-outline' | 'account-outline' | 'credit-card-outline';
  }> = [
    { step: 1, label: 'Stay', marathi: 'निवास', icon: 'bed-outline' },
    { step: 2, label: 'Guest', marathi: 'पाहुणे', icon: 'account-outline' },
    { step: 3, label: 'Payment', marathi: 'पेमेंट', icon: 'credit-card-outline' },
  ];
  return (
    <View className="flex-row rounded-3xl border border-warm-200 bg-white p-2">
      {items.map((item) => {
        const active = item.step === step;
        const completed = item.step < step;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(item.label, item.marathi)}
            key={item.step}
            onPress={() => onSelect(item.step)}
            className={`flex-1 items-center rounded-2xl px-2 py-3 ${active ? 'bg-saffron-50' : ''}`}
          >
            <MaterialCommunityIcons
              color={active || completed ? ui.saffronDeep : ui.muted}
              name={item.icon}
              size={23}
            />
            <Text
              className={`mt-1 text-xs font-extrabold ${active ? 'text-saffron-700' : 'text-warm-600'}`}
            >
              {t(item.label, item.marathi)}
            </Text>
            <View
              className={`mt-2 h-1 w-10 rounded-full ${item.step <= step ? 'bg-saffron-500' : 'bg-warm-200'}`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text className="text-xl font-extrabold text-warm-900">{title}</Text>;
}
function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-4 flex-row justify-between gap-4">
      <Text className="flex-1 text-sm text-warm-500">{label}</Text>
      <Text className="text-sm font-bold text-warm-900">{value}</Text>
    </View>
  );
}
function PaymentOption({
  active,
  icon,
  label,
  description,
  onPress,
}: {
  active: boolean;
  icon: 'cash' | 'qrcode-scan';
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-20 flex-row items-center gap-3 rounded-2xl border bg-white p-4 ${active ? 'border-2 border-saffron-500' : 'border-warm-200'}`}
    >
      <MaterialCommunityIcons color={active ? ui.saffronDeep : ui.muted} name={icon} size={25} />
      <View className="flex-1">
        <Text className="text-base font-extrabold text-warm-900">{label}</Text>
        <Text className="mt-1 text-xs leading-4 text-warm-500">{description}</Text>
      </View>
      <MaterialCommunityIcons
        color={active ? ui.saffronDeep : ui.muted}
        name={active ? 'radiobox-marked' : 'radiobox-blank'}
        size={23}
      />
    </Pressable>
  );
}
function GuestCounter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View className="flex-row items-center rounded-2xl border border-warm-200 bg-white p-4">
      <Text className="flex-1 text-base font-extrabold text-warm-900">{label}</Text>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          className="h-10 w-10 items-center justify-center rounded-full border border-warm-200"
        >
          <MaterialCommunityIcons name="minus" color={ui.maroon} size={18} />
        </Pressable>
        <Text className="w-5 text-center font-extrabold text-warm-900">{value}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          className="h-10 w-10 items-center justify-center rounded-full border border-warm-200"
        >
          <MaterialCommunityIcons name="plus" color={ui.maroon} size={18} />
        </Pressable>
      </View>
    </View>
  );
}
interface DateOption {
  date: string;
  day: string;
  month: string;
  weekday: string;
}
function DateSelector({
  label,
  options,
  selectedDate,
  onSelect,
}: {
  label: string;
  options: DateOption[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <View>
      <Text className="mb-2 text-sm font-bold text-warm-700">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {options.map((option) => {
          const selected = option.date === selectedDate;
          return (
            <Pressable
              key={option.date}
              onPress={() => onSelect(option.date)}
              className={`min-h-20 min-w-20 items-center justify-center rounded-2xl border px-3 ${selected ? 'border-saffron-500 bg-saffron-50' : 'border-warm-200 bg-white'}`}
            >
              <Text className="text-[11px] font-bold uppercase text-warm-500">
                {option.weekday}
              </Text>
              <Text
                className={`text-xl font-extrabold ${selected ? 'text-saffron-700' : 'text-warm-900'}`}
              >
                {option.day}
              </Text>
              <Text className="text-xs font-semibold text-warm-500">{option.month}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}
function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function buildDateOptions(startDate: Date, count: number): DateOption[] {
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      date: toDateOnly(date),
      day: String(date.getDate()),
      month: date.toLocaleDateString('en-IN', { month: 'short' }),
      weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }),
    };
  });
}
function daysBetween(startDate: string, endDate: string) {
  return Math.round(
    (parseDateOnly(endDate).getTime() - parseDateOnly(startDate).getTime()) / 86_400_000,
  );
}
function resolveIdProofMimeType(
  fileName: string,
  suppliedMimeType?: string,
): GuestIdProofFile['mimeType'] | null {
  if (allowedIdProofTypes.some((value) => value === suppliedMimeType)) return suppliedMimeType!;
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'pdf') return 'application/pdf';
  return null;
}
