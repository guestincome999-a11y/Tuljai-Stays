import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../../auth/auth-context';
import type { GuestIdProofFile } from '../../features/bookings/api/bookings-api';
import { AppScreen, EmptyState, Field, PrimaryButton, TopBar, ui } from '../components';
import { formatRupees } from '../mock-data';
import { usePilgrimApp } from '../PilgrimAppProvider';

const allowedIdProofTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const maxIdProofSizeBytes = 5 * 1024 * 1024;
const initialCheckInDate = toDateOnly(addDays(startOfToday(), 1));
const initialCheckOutDate = toDateOnly(addDays(startOfToday(), 2));
let guestIdProofPickerOpen = false;

export function PilgrimCheckoutScreen() {
  const params = useLocalSearchParams<{ lodgeId?: string; roomTypeId?: string }>();
  const router = useRouter();
  const auth = useAuth();
  const { createBooking, lodges, t } = usePilgrimApp();
  const lodge = lodges.find((item) => item.id === params.lodgeId);
  const initialRoom = lodge?.rooms.find((item) => item.id === params.roomTypeId) ?? lodge?.rooms[0];
  const [step, setStep] = useState(1);
  const [roomId, setRoomId] = useState(initialRoom?.id ?? '');
  const [checkInDate, setCheckInDate] = useState(initialCheckInDate);
  const [checkOutDate, setCheckOutDate] = useState(initialCheckOutDate);
  const [checkoutDateFlexible, setCheckoutDateFlexible] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [name, setName] = useState(auth.user?.displayName?.trim() ?? '');
  const [phone, setPhone] = useState(auth.user?.phoneNumber?.replace(/\D/gu, '').slice(-10) ?? '');
  const [email, setEmail] = useState('');
  const [guestIdProof, setGuestIdProof] = useState<GuestIdProofFile | null>(null);
  const documentPickerActiveRef = useRef(false);
  const [isDocumentPickerActive, setIsDocumentPickerActive] = useState(false);
  const [request, setRequest] = useState('');
  const [payment, setPayment] = useState<'online' | 'lodge'>('lodge');
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const room = lodge?.rooms.find((item) => item.id === roomId) ?? lodge?.rooms[0];
  const checkInOptions = useMemo(() => buildDateOptions(startOfToday(), 90), []);
  const checkoutOptions = useMemo(
    () => buildDateOptions(addDays(parseDateOnly(checkInDate), 1), 60),
    [checkInDate],
  );
  const provisionalCheckOutDate = checkoutDateFlexible
    ? toDateOnly(addDays(parseDateOnly(checkInDate), 1))
    : checkOutDate;
  const nights = checkoutDateFlexible ? 1 : Math.max(daysBetween(checkInDate, checkOutDate), 1);
  const subtotal = (room?.price ?? 0) * nights;
  const taxes = Math.round(subtotal * 0.05);
  const total = subtotal + taxes;
  const stayLabel = checkoutDateFlexible
    ? `${formatDisplayDate(checkInDate)} · ${t('Checkout not fixed', 'चेक-आउट निश्चित नाही')}`
    : `${formatDisplayDate(checkInDate)} – ${formatDisplayDate(checkOutDate)}`;

  const stepMeta = useMemo(
    () => [
      { label: t('Stay', 'निवास'), icon: 'bed-outline' as const },
      { label: t('Guest', 'पाहुणे'), icon: 'account-outline' as const },
      { label: t('Payment', 'पेमेंट'), icon: 'credit-card-outline' as const },
    ],
    [t],
  );

  function continueFlow() {
    if (step === 2 && (!name.trim() || phone.replace(/\D/g, '').length !== 10)) {
      Alert.alert(
        t('Check guest details', 'पाहुण्यांची माहिती तपासा'),
        t(
          'Enter a name and valid 10-digit mobile number.',
          'नाव आणि वैध १० अंकी मोबाइल क्रमांक टाका.',
        ),
      );
      return;
    }
    if (step === 2 && email.trim() && !/^\S+@\S+\.\S+$/u.test(email.trim())) {
      Alert.alert(
        t('Check email address', 'ईमेल पत्ता तपासा'),
        t('Enter a valid email or leave it blank.', 'वैध ईमेल टाका किंवा रिकामा ठेवा.'),
      );
      return;
    }
    if (step === 2 && !guestIdProof) {
      Alert.alert(
        t('Upload guest ID proof', 'पाहुण्याचे ओळखपत्र अपलोड करा'),
        t(
          'A government photo ID proof is required to continue this booking.',
          'हे बुकिंग पुढे सुरू ठेवण्यासाठी सरकारी फोटो ओळखपत्र आवश्यक आहे.',
        ),
      );
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function pickGuestIdProof() {
    if (documentPickerActiveRef.current || guestIdProofPickerOpen) return;

    guestIdProofPickerOpen = true;
    documentPickerActiveRef.current = true;
    setIsDocumentPickerActive(true);
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: Platform.OS !== 'android',
        multiple: false,
        type: Platform.OS === 'android' ? '*/*' : [...allowedIdProofTypes],
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const mimeType = resolveIdProofMimeType(asset.name, asset.mimeType);
      if (!mimeType) {
        Alert.alert(
          t('Unsupported file', 'फाइल प्रकार समर्थित नाही'),
          t('Choose a clear JPEG, PNG or PDF file.', 'स्पष्ट JPEG, PNG किंवा PDF फाइल निवडा.'),
        );
        return;
      }
      const sizeBytes = asset.size ?? asset.file?.size;
      if (sizeBytes && sizeBytes > maxIdProofSizeBytes) {
        Alert.alert(
          t('File is too large', 'फाइल खूप मोठी आहे'),
          t('Choose an ID proof up to 5 MB.', '५ MB पर्यंतचे ओळखपत्र निवडा.'),
        );
        return;
      }

      setGuestIdProof({
        mimeType,
        name: asset.name,
        sizeBytes,
        uri: asset.uri,
        webFile: asset.file,
      });
    } catch {
      Alert.alert(
        t('Could not open documents', 'कागदपत्रे उघडता आली नाहीत'),
        t('Please try choosing the ID proof again.', 'कृपया ओळखपत्र पुन्हा निवडा.'),
      );
    } finally {
      setTimeout(() => {
        guestIdProofPickerOpen = false;
        documentPickerActiveRef.current = false;
        setIsDocumentPickerActive(false);
      }, 750);
    }
  }

  async function confirmBooking() {
    if (!lodge || !room) {
      Alert.alert(
        t('Room is not available', 'खोली उपलब्ध नाही'),
        t(
          'Please return to Explore and choose another room.',
          'कृपया शोधामध्ये जाऊन दुसरी खोली निवडा.',
        ),
      );
      return;
    }
    if (!guestIdProof) {
      setStep(2);
      Alert.alert(
        t('Upload guest ID proof', 'पाहुण्याचे ओळखपत्र अपलोड करा'),
        t(
          'A government photo ID proof is required before confirmation.',
          'पुष्टीकरणापूर्वी सरकारी फोटो ओळखपत्र आवश्यक आहे.',
        ),
      );
      return;
    }
    if (!agree) {
      Alert.alert(
        t('Accept booking terms', 'बुकिंग अटी स्वीकारा'),
        t(
          'Please confirm the stay rules and cancellation policy.',
          'निवास नियम आणि रद्दीकरण धोरण मान्य करा.',
        ),
      );
      return;
    }
    setSubmitting(true);
    try {
      const booking = await createBooking({
        checkInDate,
        checkOutDate: provisionalCheckOutDate,
        checkoutDateFlexible,
        guestEmail: email,
        guestIdProof,
        guestName: name,
        guestPhone: phone,
        lodgeId: lodge.id,
        numberOfAdults: adults,
        numberOfChildren: children,
        roomId: room.id,
        specialRequest: request,
      });
      router.replace({
        pathname: '/(app)/bookings/[id]',
        params: { id: booking.id, justBooked: '1' },
      });
    } catch (error) {
      Alert.alert(
        t('Booking could not be completed', 'बुकिंग पूर्ण होऊ शकले नाही'),
        error instanceof Error
          ? error.message
          : t('Please try again.', 'कृपया पुन्हा प्रयत्न करा.'),
      );
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
    <AppScreen className="gap-6 pt-1">
      <TopBar
        onBack={() => (step === 1 ? router.back() : setStep((current) => current - 1))}
        subtitle={lodge.name}
        title={t('Complete your booking', 'बुकिंग पूर्ण करा')}
      />

      <View className="flex-row items-start">
        {stepMeta.map((item, index) => {
          const number = index + 1;
          const active = number <= step;
          return (
            <View className="flex-1 items-center" key={item.label}>
              <View className="w-full flex-row items-center">
                {index > 0 ? (
                  <View
                    className={`h-0.5 flex-1 ${number <= step ? 'bg-saffron-500' : 'bg-warm-200'}`}
                  />
                ) : (
                  <View className="flex-1" />
                )}
                <View
                  className={`h-11 w-11 items-center justify-center rounded-full ${active ? 'bg-saffron-500' : 'bg-warm-200'}`}
                >
                  <MaterialCommunityIcons
                    color={active ? '#FFFFFF' : ui.muted}
                    name={item.icon}
                    size={20}
                  />
                </View>
                {index < stepMeta.length - 1 ? (
                  <View
                    className={`h-0.5 flex-1 ${number < step ? 'bg-saffron-500' : 'bg-warm-200'}`}
                  />
                ) : (
                  <View className="flex-1" />
                )}
              </View>
              <Text
                className={`mt-2 text-xs font-bold ${number === step ? 'text-saffron-700' : 'text-warm-500'}`}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>

      {step === 1 ? (
        <View className="gap-6">
          <View>
            <Text className="text-xl font-extrabold text-warm-900">
              {t('Select room', 'खोली निवडा')}
            </Text>
            <View className="mt-4 gap-3">
              {lodge.rooms.map((item) => {
                const selected = roomId === item.id;
                return (
                  <Pressable
                    className={`rounded-3xl border bg-white p-4 ${selected ? 'border-2 border-saffron-500' : 'border-warm-200'}`}
                    key={item.id}
                    onPress={() => setRoomId(item.id)}
                  >
                    <View className="flex-row items-start gap-3">
                      <MaterialCommunityIcons
                        color={selected ? ui.saffronDeep : ui.muted}
                        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                        size={24}
                      />
                      <View className="flex-1">
                        <Text className="text-base font-extrabold text-warm-900">{item.name}</Text>
                        <Text className="mt-1 text-sm text-warm-500">
                          {item.bed} · {item.capacity}
                        </Text>
                        <Text className="mt-2 text-lg font-extrabold text-maroon-700">
                          {formatRupees(item.price)}{' '}
                          <Text className="text-xs font-medium text-warm-500">/ night</Text>
                        </Text>
                      </View>
                      <View className="rounded-lg bg-bell-50 px-2 py-1">
                        <Text className="text-[11px] font-extrabold text-bell-700">
                          {item.available} left
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="text-xl font-extrabold text-warm-900">
              {t('Choose dates', 'तारखा निवडा')}
            </Text>
            <Text className="mt-1 text-sm text-warm-500">
              {t(
                'Select your check-in and checkout separately.',
                'चेक-इन आणि चेक-आउटच्या तारखा स्वतंत्रपणे निवडा.',
              )}
            </Text>
            <View className="mt-4 gap-4">
              <DateSelector
                label={t('Check-in date', 'चेक-इन तारीख')}
                onSelect={(value) => {
                  setCheckInDate(value);
                  if (checkOutDate <= value) {
                    setCheckOutDate(toDateOnly(addDays(parseDateOnly(value), 1)));
                  }
                }}
                options={checkInOptions}
                selectedDate={checkInDate}
              />
              <DateSelector
                disabled={checkoutDateFlexible}
                label={t('Checkout date', 'चेक-आउट तारीख')}
                onSelect={setCheckOutDate}
                options={checkoutOptions}
                selectedDate={checkOutDate}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: checkoutDateFlexible }}
                className={`flex-row items-start gap-3 rounded-2xl border p-4 ${
                  checkoutDateFlexible
                    ? 'border-saffron-500 bg-saffron-50'
                    : 'border-warm-200 bg-white'
                }`}
                onPress={() => setCheckoutDateFlexible((value) => !value)}
              >
                <MaterialCommunityIcons
                  color={checkoutDateFlexible ? ui.saffronDeep : ui.muted}
                  name={checkoutDateFlexible ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={24}
                />
                <View className="flex-1">
                  <Text className="text-sm font-extrabold text-warm-900">
                    {t('My checkout date is not fixed', 'माझी चेक-आउट तारीख निश्चित नाही')}
                  </Text>
                  <Text className="mt-1 text-xs leading-4 text-warm-500">
                    {t(
                      'We will hold the first night now. Confirm the final checkout with the lodge.',
                      'आत्ता पहिली रात्र राखीव ठेवली जाईल. अंतिम चेक-आउट तारीख लॉजसोबत निश्चित करा.',
                    )}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <View>
            <Text className="text-xl font-extrabold text-warm-900">{t('Guests', 'पाहुणे')}</Text>
            <View className="mt-4 overflow-hidden rounded-2xl border border-warm-100 bg-white px-4">
              <GuestStepper
                label={t('Adults', 'प्रौढ')}
                subtitle={t('Age 13 years and above', '१३ वर्षे आणि त्याहून अधिक')}
                value={adults}
                onDecrease={() => setAdults((value) => Math.max(1, value - 1))}
                onIncrease={() => setAdults((value) => Math.min(4, value + 1))}
              />
              <GuestStepper
                label={t('Children', 'मुले')}
                subtitle={t('Age 2–12 years', '२–१२ वर्षे')}
                value={children}
                onDecrease={() => setChildren((value) => Math.max(0, value - 1))}
                onIncrease={() => setChildren((value) => Math.min(2, value + 1))}
                last
              />
            </View>
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View className="gap-5">
          <View>
            <Text className="text-xl font-extrabold text-warm-900">
              {t('Who is checking in?', 'चेक-इन कोण करणार?')}
            </Text>
            <Text className="mt-1 text-sm leading-5 text-warm-500">
              {t(
                'The lead guest should carry a valid government photo ID.',
                'मुख्य पाहुण्याने वैध सरकारी फोटो ओळखपत्र आणावे.',
              )}
            </Text>
          </View>
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
            placeholder="For booking confirmation"
            value={email}
          />
          <View>
            <View className="mb-2 flex-row items-center gap-1">
              <Text className="text-sm font-bold text-warm-700">
                {t('Guest ID proof', 'पाहुण्याचे ओळखपत्र')}
              </Text>
              <Text className="text-sm font-extrabold text-danger-600">*</Text>
            </View>
            {guestIdProof ? (
              <View className="rounded-2xl border-2 border-templeGreen-500 bg-templeGreen-50 p-4">
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white">
                    <MaterialCommunityIcons
                      color={ui.green}
                      name="file-document-check-outline"
                      size={25}
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-extrabold text-warm-900" numberOfLines={1}>
                      {guestIdProof.name}
                    </Text>
                    <Text className="mt-1 text-xs font-semibold text-templeGreen-700">
                      {t('Ready to upload', 'अपलोड करण्यासाठी तयार')}
                      {guestIdProof.sizeBytes ? ` · ${formatFileSize(guestIdProof.sizeBytes)}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel={t('Remove ID proof', 'ओळखपत्र काढा')}
                    accessibilityRole="button"
                    className="h-11 w-11 items-center justify-center rounded-full bg-white"
                    onPress={() => setGuestIdProof(null)}
                  >
                    <MaterialCommunityIcons color={ui.danger} name="delete-outline" size={22} />
                  </Pressable>
                </View>
                <Pressable
                  accessibilityState={{
                    busy: isDocumentPickerActive,
                    disabled: isDocumentPickerActive,
                  }}
                  accessibilityRole="button"
                  className="mt-3 min-h-12 flex-row items-center justify-center gap-2 rounded-xl border border-templeGreen-200 bg-white"
                  disabled={isDocumentPickerActive}
                  onPress={() => void pickGuestIdProof()}
                >
                  <MaterialCommunityIcons color={ui.green} name="swap-horizontal" size={20} />
                  <Text className="text-sm font-extrabold text-templeGreen-700">
                    {t('Choose a different file', 'दुसरी फाइल निवडा')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityHint={t(
                  'Choose Aadhaar, driving licence, voter ID or passport',
                  'आधार, वाहन परवाना, मतदार ओळखपत्र किंवा पासपोर्ट निवडा',
                )}
                accessibilityState={{
                  busy: isDocumentPickerActive,
                  disabled: isDocumentPickerActive,
                }}
                accessibilityRole="button"
                className="min-h-32 items-center justify-center rounded-2xl border-2 border-dashed border-saffron-300 bg-saffron-50 px-5 py-5"
                disabled={isDocumentPickerActive}
                onPress={() => void pickGuestIdProof()}
              >
                <View className="h-12 w-12 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons color={ui.saffronDeep} name="upload-outline" size={25} />
                </View>
                <Text className="mt-3 text-center text-base font-extrabold text-maroon-700">
                  {t('Upload government ID', 'सरकारी ओळखपत्र अपलोड करा')}
                </Text>
                <Text className="mt-1 text-center text-xs leading-5 text-warm-500">
                  {t(
                    'Aadhaar, driving licence, voter ID or passport · JPEG, PNG or PDF · Max 5 MB',
                    'आधार, वाहन परवाना, मतदार ओळखपत्र किंवा पासपोर्ट · JPEG, PNG किंवा PDF · कमाल ५ MB',
                  )}
                </Text>
              </Pressable>
            )}
            <View className="mt-2 flex-row items-start gap-2 px-1">
              <MaterialCommunityIcons color={ui.muted} name="lock-outline" size={16} />
              <Text className="flex-1 text-xs leading-4 text-warm-500">
                {t(
                  'Stored securely and used only for guest verification.',
                  'सुरक्षितपणे साठवले जाते आणि फक्त पाहुण्याच्या पडताळणीसाठी वापरले जाते.',
                )}
              </Text>
            </View>
          </View>
          <Field
            icon="message-text-outline"
            label={t('Special request (optional)', 'विशेष विनंती (ऐच्छिक)')}
            multiline
            onChangeText={setRequest}
            placeholder={t(
              'Early check-in, senior citizen assistance…',
              'लवकर चेक-इन, ज्येष्ठ नागरिक मदत…',
            )}
            style={{ minHeight: 84, paddingVertical: 12, textAlignVertical: 'top' }}
            value={request}
          />
          <View className="flex-row items-start gap-3 rounded-2xl bg-saffron-50 p-4">
            <MaterialCommunityIcons color={ui.saffronDeep} name="shield-lock-outline" size={22} />
            <Text className="flex-1 text-sm leading-5 text-warm-600">
              {t(
                'Your contact details are shared only with the lodge for this booking.',
                'तुमची संपर्क माहिती फक्त या बुकिंगसाठी लॉजसोबत शेअर केली जाईल.',
              )}
            </Text>
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View className="gap-6">
          <View>
            <Text className="text-xl font-extrabold text-warm-900">
              {t('Choose payment', 'पेमेंट निवडा')}
            </Text>
            <Text className="mt-1 text-sm text-warm-500">
              {t(
                'Secure payment. No hidden platform fee.',
                'सुरक्षित पेमेंट. कोणतेही लपलेले शुल्क नाही.',
              )}
            </Text>
          </View>
          <View className="gap-3">
            <PaymentOption
              active={false}
              icon="qrcode-scan"
              label={t('Pay online · Coming soon', 'ऑनलाइन पेमेंट · लवकरच')}
              offer={t('UPI and cards are being enabled', 'UPI आणि कार्ड लवकरच सुरू होतील')}
              onPress={() =>
                Alert.alert(
                  t('Online payment is coming soon', 'ऑनलाइन पेमेंट लवकरच येत आहे'),
                  t(
                    'Choose Pay at the lodge to complete this booking.',
                    'हे बुकिंग पूर्ण करण्यासाठी लॉजवर पैसे भरा निवडा.',
                  ),
                )
              }
            />
            <PaymentOption
              active={payment === 'lodge'}
              icon="cash"
              label={t('Pay at the lodge', 'लॉजवर पैसे भरा')}
              offer={t('Room held until arrival time', 'आगमन वेळेपर्यंत खोली राखीव')}
              onPress={() => setPayment('lodge')}
            />
          </View>

          <View className="rounded-3xl border border-warm-100 bg-white p-5">
            <Text className="text-lg font-extrabold text-warm-900">
              {t('Price details', 'किंमत तपशील')}
            </Text>
            <PriceRow
              label={
                checkoutDateFlexible
                  ? t('First-night provisional charge', 'पहिल्या रात्रीचे अंदाजे शुल्क')
                  : `${formatRupees(room.price)} × ${nights} ${t('nights', 'रात्री')}`
              }
              value={formatRupees(subtotal)}
            />
            <PriceRow
              label={t('Taxes and lodge charges', 'कर आणि लॉज शुल्क')}
              value={formatRupees(taxes)}
            />
            <View className="mt-3 flex-row items-center justify-between border-t border-warm-100 pt-4">
              <Text className="text-base font-extrabold text-warm-900">
                {checkoutDateFlexible
                  ? t('Provisional amount', 'अंदाजे रक्कम')
                  : t('Total amount', 'एकूण रक्कम')}
              </Text>
              <Text className="text-2xl font-extrabold text-maroon-700">{formatRupees(total)}</Text>
            </View>
          </View>

          <Pressable
            className="flex-row items-start gap-3"
            onPress={() => setAgree((value) => !value)}
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

      <View className="mt-2 rounded-3xl bg-warm-100 p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xs font-semibold text-warm-500">
              {step === 3 ? t('Amount payable', 'देय रक्कम') : t('Estimated total', 'अंदाजे एकूण')}
            </Text>
            <Text className="mt-1 text-xl font-extrabold text-warm-900">{formatRupees(total)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-xs font-semibold text-warm-500">
              {checkoutDateFlexible
                ? t('First night estimate', 'पहिल्या रात्रीचा अंदाज')
                : `${nights} ${t('nights', 'रात्री')}`}
            </Text>
            <Text className="mt-1 max-w-52 text-right text-sm font-bold text-warm-700">
              {stayLabel}
            </Text>
          </View>
        </View>
      </View>
      {step < 3 ? (
        <PrimaryButton icon="arrow-right" onPress={continueFlow}>
          {t('Continue', 'पुढे चला')}
        </PrimaryButton>
      ) : (
        <PrimaryButton
          icon={payment === 'online' ? 'lock-outline' : 'check-circle-outline'}
          loading={submitting}
          onPress={() => void confirmBooking()}
        >
          {payment === 'online'
            ? t(`Pay ${formatRupees(total)}`, `${formatRupees(total)} भरा`)
            : t('Confirm booking', 'बुकिंग निश्चित करा')}
        </PrimaryButton>
      )}
      <Text className="text-center text-xs text-warm-500">
        {t('Protected by Tuljai Stays booking support', 'तुळजाई स्टेज बुकिंग सहाय्याने संरक्षित')}
      </Text>
    </AppScreen>
  );
}

interface DateOption {
  date: string;
  day: string;
  month: string;
  weekday: string;
}

function DateSelector({
  disabled = false,
  label,
  onSelect,
  options,
  selectedDate,
}: {
  disabled?: boolean;
  label: string;
  onSelect: (date: string) => void;
  options: DateOption[];
  selectedDate: string;
}) {
  return (
    <View className={disabled ? 'opacity-40' : ''}>
      <Text className="mb-2 text-sm font-bold text-warm-700">{label}</Text>
      <ScrollView
        contentContainerStyle={{ gap: 8, paddingRight: 12 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {options.map((option) => {
          const selected = option.date === selectedDate;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled, selected }}
              className={`min-h-20 min-w-20 items-center justify-center rounded-2xl border px-3 ${
                selected ? 'border-saffron-500 bg-saffron-50' : 'border-warm-200 bg-white'
              }`}
              disabled={disabled}
              key={option.date}
              onPress={() => onSelect(option.date)}
            >
              <Text className="text-[11px] font-bold uppercase text-warm-500">
                {option.weekday}
              </Text>
              <Text
                className={`mt-0.5 text-xl font-extrabold ${
                  selected ? 'text-saffron-700' : 'text-warm-900'
                }`}
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

function startOfToday(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function daysBetween(startDate: string, endDate: string): number {
  return Math.round(
    (parseDateOnly(endDate).getTime() - parseDateOnly(startDate).getTime()) / 86_400_000,
  );
}

function formatDisplayDate(value: string): string {
  return parseDateOnly(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function GuestStepper({
  label,
  subtitle,
  value,
  onDecrease,
  onIncrease,
  last = false,
}: {
  label: string;
  last?: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  subtitle: string;
  value: number;
}) {
  return (
    <View className={`min-h-20 flex-row items-center ${last ? '' : 'border-b border-warm-100'}`}>
      <View className="flex-1">
        <Text className="text-base font-extrabold text-warm-900">{label}</Text>
        <Text className="mt-1 text-xs text-warm-500">{subtitle}</Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-full border border-warm-200"
          onPress={onDecrease}
        >
          <MaterialCommunityIcons color={ui.maroon} name="minus" size={20} />
        </Pressable>
        <Text className="w-5 text-center text-base font-extrabold text-warm-900">{value}</Text>
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-full border border-warm-200"
          onPress={onIncrease}
        >
          <MaterialCommunityIcons color={ui.maroon} name="plus" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

function PaymentOption({
  active,
  icon,
  label,
  offer,
  onPress,
}: {
  active: boolean;
  icon: 'cash' | 'qrcode-scan';
  label: string;
  offer: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`min-h-20 flex-row items-center gap-3 rounded-2xl border bg-white p-4 ${active ? 'border-2 border-saffron-500' : 'border-warm-200'}`}
      onPress={onPress}
    >
      <View
        className={`h-12 w-12 items-center justify-center rounded-2xl ${active ? 'bg-saffron-50' : 'bg-warm-100'}`}
      >
        <MaterialCommunityIcons color={active ? ui.saffronDeep : ui.muted} name={icon} size={24} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-extrabold text-warm-900">{label}</Text>
        <Text className="mt-1 text-xs text-warm-500">{offer}</Text>
      </View>
      <MaterialCommunityIcons
        color={active ? ui.saffronDeep : '#D7C8B8'}
        name={active ? 'radiobox-marked' : 'radiobox-blank'}
        size={24}
      />
    </Pressable>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-4 flex-row items-center justify-between gap-4">
      <Text className="flex-1 text-sm text-warm-500">{label}</Text>
      <Text className="text-sm font-bold text-warm-900">{value}</Text>
    </View>
  );
}

function resolveIdProofMimeType(
  fileName: string,
  suppliedMimeType?: string,
): GuestIdProofFile['mimeType'] | null {
  if (allowedIdProofTypes.some((value) => value === suppliedMimeType)) {
    return suppliedMimeType!;
  }

  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'pdf') return 'application/pdf';
  return null;
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
