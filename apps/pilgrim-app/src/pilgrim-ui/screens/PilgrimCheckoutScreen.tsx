import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';

import { useAuth } from '../../auth/auth-context';
import {
  cancelBooking,
  createBooking,
  createBookingLock,
  createRazorpayOrder,
  uploadGuestIdProof,
  verifyRazorpayPayment,
  type GuestIdProofFile,
} from '../../features/bookings/api/bookings-api';
import { AppScreen, EmptyState, Field, PrimaryButton, TopBar, ui } from '../components';
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
  const { lodges, t } = usePilgrimApp();
  const lodge = lodges.find((item) => item.id === params.lodgeId);
  const initialRoom = lodge?.rooms.find((item) => item.id === params.roomTypeId) ?? lodge?.rooms[0];

  const [step, setStep] = useState<Step>(1);
  const [furthestStepReached, setFurthestStepReached] = useState<Step>(1);
  const [roomId, setRoomId] = useState(initialRoom?.id ?? '');
  const [checkInDate, setCheckInDate] = useState(toDateOnly(addDays(startOfToday(), 1)));
  const [checkOutDate, setCheckOutDate] = useState(toDateOnly(addDays(startOfToday(), 2)));
  const [checkoutDateFlexible, setCheckoutDateFlexible] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [name, setName] = useState(auth.user?.displayName?.trim() ?? '');
  const [phone, setPhone] = useState(auth.user?.phoneNumber?.replace(/\D/gu, '').slice(-10) ?? '');
  const [email, setEmail] = useState('');
  const [guestIdProof, setGuestIdProof] = useState<GuestIdProofFile | null>(null);
  const [request, setRequest] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PAY_AT_LODGE');
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pickerActiveRef = useRef(false);

  const room = lodge?.rooms.find((item) => item.id === roomId) ?? lodge?.rooms[0];
  const checkInOptions = useMemo(() => buildDateOptions(startOfToday(), 90), []);
  const checkoutOptions = useMemo(
    () => buildDateOptions(addDays(parseDateOnly(checkInDate), 1), 60),
    [checkInDate],
  );
  const provisionalCheckout = checkoutDateFlexible
    ? toDateOnly(addDays(parseDateOnly(checkInDate), 1))
    : checkOutDate;
  const nights = checkoutDateFlexible ? 1 : Math.max(daysBetween(checkInDate, checkOutDate), 1);
  const subtotal = (room?.price ?? 0) * nights;
  const taxes = Math.round(subtotal * 0.05);
  const total = subtotal + taxes;

  function validateGuest(): boolean {
    if (!name.trim() || phone.replace(/\D/gu, '').length !== 10) {
      Alert.alert(t('Check guest details', 'पाहुण्यांची माहिती तपासा'), t('Enter a name and valid 10-digit mobile number.', 'नाव आणि वैध १० अंकी मोबाइल क्रमांक टाका.'));
      return false;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/u.test(email.trim())) {
      Alert.alert(t('Check email address', 'ईमेल पत्ता तपासा'), t('Enter a valid email or leave it blank.', 'वैध ईमेल टाका किंवा रिकामा ठेवा.'));
      return false;
    }
    if (!guestIdProof) {
      Alert.alert(t('Upload guest ID proof', 'पाहुण्याचे ओळखपत्र अपलोड करा'), t('A government photo ID proof is required.', 'सरकारी फोटो ओळखपत्र आवश्यक आहे.'));
      return false;
    }
    return true;
  }

  function continueFlow() {
    if (step === 2 && !validateGuest()) return;
    const next = Math.min(3, step + 1) as Step;
    setFurthestStepReached((current) => Math.max(current, next) as Step);
    setStep(next);
  }

  async function pickGuestIdProof() {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;
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
      if (!mimeType) throw new Error(t('Choose a JPEG, PNG or PDF file.', 'JPEG, PNG किंवा PDF फाइल निवडा.'));
      const sizeBytes = asset.size ?? asset.file?.size;
      if (sizeBytes && sizeBytes > maxIdProofSizeBytes) throw new Error(t('ID proof must be 5 MB or smaller.', 'ओळखपत्र ५ MB किंवा त्यापेक्षा कमी असावे.'));
      setGuestIdProof({ mimeType, name: asset.name, sizeBytes, uri: asset.uri, webFile: asset.file });
    } catch (error) {
      if (error instanceof Error) Alert.alert(t('ID proof', 'ओळखपत्र'), error.message);
    } finally {
      pickerActiveRef.current = false;
    }
  }

  async function confirmBooking() {
    if (!lodge || !room) {
      Alert.alert(t('Room unavailable', 'खोली उपलब्ध नाही'), t('Please choose another room.', 'कृपया दुसरी खोली निवडा.'));
      return;
    }
    if (!validateGuest() || !agree) {
      if (!agree) Alert.alert(t('Accept booking terms', 'बुकिंग अटी स्वीकारा'), t('Please accept the lodge rules and cancellation terms.', 'लॉजचे नियम आणि रद्दीकरण अटी मान्य करा.'));
      return;
    }

    setSubmitting(true);
    let bookingId: string | null = null;
    let razorpayStarted = false;
    try {
      const uploaded = await uploadGuestIdProof(guestIdProof!);
      const lock = await createBookingLock({
        checkInDate,
        checkOutDate: provisionalCheckout,
        lodgeId: lodge.id,
        roomTypeId: room.id,
      });
      const booking = await createBooking({
        checkoutDateFlexible,
        guestEmail: email.trim() || undefined,
        guestIdProofMimeType: uploaded.mimeType,
        guestIdProofOriginalName: uploaded.originalName,
        guestIdProofSizeBytes: uploaded.sizeBytes,
        guestIdProofStoragePath: uploaded.storagePath,
        guestName: name.trim(),
        guestPhone: phone.startsWith('+') ? phone : `+91${phone.replace(/\D/gu, '')}`,
        lockCode: lock.lockCode,
        numberOfAdults: adults,
        numberOfChildren: children,
        paymentMethod,
        specialRequest: request.trim() || undefined,
      });
      bookingId = booking.id;

      if (paymentMethod === 'ONLINE') {
        const order = await createRazorpayOrder(booking.id);
        razorpayStarted = true;
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
        if (verified.paymentStatus !== 'PAID' || verified.status !== 'ACCEPTED') {
          throw new Error(t('Payment is being reconciled. Check your booking status shortly.', 'पेमेंट पडताळले जात आहे. थोड्या वेळाने बुकिंग स्थिती तपासा.'));
        }
      }

      Alert.alert(
        paymentMethod === 'ONLINE' ? t('Payment successful', 'पेमेंट यशस्वी') : t('Booking request sent', 'बुकिंग विनंती पाठवली'),
        paymentMethod === 'ONLINE'
          ? t('Your prepaid room is confirmed immediately. No lodge approval is required.', 'तुमची प्रीपेड खोली त्वरित निश्चित झाली आहे. लॉजची मंजुरी आवश्यक नाही.')
          : t('The lodge owner will review your request before confirmation.', 'पुष्टीकरणापूर्वी लॉज मालक तुमची विनंती तपासतील.'),
      );
      router.replace({ pathname: '/(app)/bookings/[id]', params: { id: booking.id, justBooked: '1' } });
    } catch (error) {
      if (bookingId && paymentMethod === 'ONLINE' && !razorpayStarted) {
        await cancelBooking(bookingId, 'Razorpay order could not be started').catch(() => undefined);
      }
      Alert.alert(t('Booking could not be completed', 'बुकिंग पूर्ण होऊ शकले नाही'), error instanceof Error ? error.message : t('Please try again.', 'कृपया पुन्हा प्रयत्न करा.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!lodge || !room) {
    return <AppScreen className="gap-6 pt-1"><TopBar onBack={() => router.back()} title={t('Complete your booking', 'बुकिंग पूर्ण करा')} /><EmptyState action={t('Choose another stay', 'दुसरा निवास निवडा')} body={t('This lodge has no bookable room right now.', 'या लॉजमध्ये सध्या बुक करण्यायोग्य खोली नाही.')} icon="bed-empty" onAction={() => router.replace('/(app)/lodges')} title={t('No room available', 'खोली उपलब्ध नाही')} /></AppScreen>;
  }

  return (
    <AppScreen className="gap-5 pt-1">
      <TopBar onBack={() => (step === 1 ? router.back() : setStep((current) => Math.max(1, current - 1) as Step))} subtitle={lodge.name} title={t('Complete your booking', 'बुकिंग पूर्ण करा')} />
      <View className="flex-row rounded-3xl border border-warm-200 bg-white p-2">
        {([1, 2, 3] as Step[]).map((item) => {
          const labels = [t('Stay', 'निवास'), t('Guest', 'पाहुणे'), t('Payment', 'पेमेंट')];
          const icons = ['bed-outline', 'account-outline', 'credit-card-outline'] as const;
          return <Pressable key={item} className={`flex-1 items-center rounded-2xl p-3 ${item === step ? 'bg-saffron-50' : ''}`} disabled={item > furthestStepReached} onPress={() => setStep(item)}><MaterialCommunityIcons color={item === step ? ui.saffronDeep : ui.muted} name={icons[item - 1]} size={20} /><Text className="mt-1 text-xs font-bold text-warm-700">{labels[item - 1]}</Text></Pressable>;
        })}
      </View>

      {step === 1 ? <View className="gap-5">
        <Text className="text-xl font-extrabold text-warm-900">{t('Select room and dates', 'खोली आणि तारखा निवडा')}</Text>
        <View className="gap-3">{lodge.rooms.map((item) => <Pressable key={item.id} onPress={() => setRoomId(item.id)} className={`rounded-3xl border bg-white p-4 ${roomId === item.id ? 'border-2 border-saffron-500' : 'border-warm-200'}`}><View className="flex-row items-center gap-3"><MaterialCommunityIcons color={roomId === item.id ? ui.saffronDeep : ui.muted} name={roomId === item.id ? 'radiobox-marked' : 'radiobox-blank'} size={24} /><View className="flex-1"><Text className="text-base font-extrabold text-warm-900">{item.name}</Text><Text className="mt-1 text-sm text-warm-500">{item.bed} · {item.capacity}</Text><Text className="mt-1 text-lg font-extrabold text-maroon-700">{formatRupees(item.price)} / night</Text></View></View></Pressable>)}</View>
        <DateSelector label={t('Check-in date', 'चेक-इन तारीख')} options={checkInOptions} selectedDate={checkInDate} onSelect={(value) => { setCheckInDate(value); if (checkOutDate <= value) setCheckOutDate(toDateOnly(addDays(parseDateOnly(value), 1))); }} />
        <DateSelector disabled={checkoutDateFlexible} label={t('Checkout date', 'चेक-आउट तारीख')} options={checkoutOptions} selectedDate={checkOutDate} onSelect={setCheckOutDate} />
        <Pressable className={`flex-row items-start gap-3 rounded-2xl border p-4 ${checkoutDateFlexible ? 'border-saffron-500 bg-saffron-50' : 'border-warm-200 bg-white'}`} onPress={() => setCheckoutDateFlexible((value) => !value)}><MaterialCommunityIcons color={checkoutDateFlexible ? ui.saffronDeep : ui.muted} name={checkoutDateFlexible ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} /><View className="flex-1"><Text className="text-sm font-extrabold text-warm-900">{t('My checkout date is not fixed', 'माझी चेक-आउट तारीख निश्चित नाही')}</Text><Text className="mt-1 text-xs text-warm-500">{t('We will hold the first night now.', 'आत्ता पहिली रात्र राखीव ठेवली जाईल.')}</Text></View></Pressable>
        <GuestStepper label={t('Adults', 'प्रौढ')} value={adults} min={1} max={6} onChange={setAdults} /><GuestStepper label={t('Children', 'मुले')} value={children} min={0} max={6} onChange={setChildren} />
      </View> : null}

      {step === 2 ? <View className="gap-5"><Text className="text-xl font-extrabold text-warm-900">{t('Guest details', 'पाहुण्यांची माहिती')}</Text><Field autoCapitalize="words" icon="account-outline" label={t('Full name', 'पूर्ण नाव')} onChangeText={setName} placeholder="As on photo ID" value={name} /><Field icon="phone-outline" keyboardType="phone-pad" label={t('Mobile number', 'मोबाइल क्रमांक')} maxLength={10} onChangeText={(value) => setPhone(value.replace(/\D/gu, ''))} placeholder="10-digit mobile number" value={phone} /><Field autoCapitalize="none" icon="email-outline" keyboardType="email-address" label={t('Email address', 'ईमेल पत्ता')} onChangeText={setEmail} placeholder="Optional" value={email} /><Pressable className="min-h-28 items-center justify-center rounded-2xl border-2 border-dashed border-saffron-300 bg-saffron-50 px-5" disabled={pickerActiveRef.current} onPress={() => void pickGuestIdProof()}><MaterialCommunityIcons color={ui.saffronDeep} name={guestIdProof ? 'file-check-outline' : 'upload-outline'} size={26} /><Text className="mt-2 text-center text-sm font-extrabold text-maroon-700">{guestIdProof?.name ?? t('Upload government ID · JPEG, PNG or PDF · Max 5 MB', 'सरकारी ओळखपत्र अपलोड करा · JPEG, PNG किंवा PDF · कमाल ५ MB')}</Text></Pressable><Field icon="message-text-outline" label={t('Special request (optional)', 'विशेष विनंती (ऐच्छिक)')} multiline onChangeText={setRequest} placeholder={t('Any request for the lodge…', 'लॉजसाठी कोणतीही विनंती…')} value={request} /></View> : null}

      {step === 3 ? <View className="gap-5"><Text className="text-xl font-extrabold text-warm-900">{t('Choose payment', 'पेमेंट निवडा')}</Text><PaymentOption active={paymentMethod === 'ONLINE'} icon="qrcode-scan" label={t('Pay online', 'ऑनलाइन पेमेंट')} description={t('UPI, cards and Razorpay · instant prepaid confirmation', 'UPI, कार्ड आणि Razorpay · त्वरित प्रीपेड पुष्टीकरण')} onPress={() => setPaymentMethod('ONLINE')} /><PaymentOption active={paymentMethod === 'PAY_AT_LODGE'} icon="cash" label={t('Pay at the lodge', 'लॉजवर पैसे भरा')} description={t('Owner approval is required before confirmation', 'पुष्टीकरणापूर्वी लॉज मालकाची मंजुरी आवश्यक')} onPress={() => setPaymentMethod('PAY_AT_LODGE')} /><View className="rounded-3xl border border-warm-100 bg-white p-5"><Text className="text-lg font-extrabold text-warm-900">{t('Price details', 'किंमत तपशील')}</Text><PriceRow label={`${formatRupees(room.price)} × ${nights} ${t('nights', 'रात्री')}`} value={formatRupees(subtotal)} /><PriceRow label={t('Taxes and lodge charges', 'कर आणि लॉज शुल्क')} value={formatRupees(taxes)} /><View className="mt-4 flex-row items-center justify-between border-t border-warm-100 pt-4"><Text className="font-extrabold text-warm-900">{t('Total', 'एकूण')}</Text><Text className="text-2xl font-extrabold text-maroon-700">{formatRupees(total)}</Text></View></View><Pressable className="flex-row items-start gap-3" onPress={() => setAgree((value) => !value)}><MaterialCommunityIcons color={agree ? ui.saffronDeep : ui.muted} name={agree ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} /><Text className="flex-1 text-sm leading-5 text-warm-600">{t('I agree to the lodge rules, guest policy and cancellation terms.', 'मी लॉजचे नियम, पाहुणे धोरण आणि रद्दीकरण अटी मान्य करतो/करते.')}</Text></Pressable></View> : null}

      {step < 3 ? <PrimaryButton icon="arrow-right" onPress={continueFlow}>{t('Continue', 'पुढे चला')}</PrimaryButton> : <PrimaryButton icon={paymentMethod === 'ONLINE' ? 'lock-outline' : 'check-circle-outline'} loading={submitting} onPress={() => void confirmBooking()}>{paymentMethod === 'ONLINE' ? t(`Pay ${formatRupees(total)}`, `${formatRupees(total)} भरा`) : t('Confirm booking', 'बुकिंग निश्चित करा')}</PrimaryButton>}
      <Text className="text-center text-xs text-warm-500">{paymentMethod === 'ONLINE' ? t('Secure Razorpay checkout · prepaid bookings do not require owner approval', 'सुरक्षित Razorpay पेमेंट · प्रीपेड बुकिंगला मालकाची मंजुरी आवश्यक नाही') : t('Your request will be sent to the lodge owner', 'तुमची विनंती लॉज मालकाकडे पाठवली जाईल')}</Text>
    </AppScreen>
  );
}

function DateSelector({ disabled = false, label, options, selectedDate, onSelect }: { disabled?: boolean; label: string; options: DateOption[]; selectedDate: string; onSelect: (value: string) => void }) {
  return <View className={disabled ? 'opacity-40' : ''}><Text className="mb-2 text-sm font-bold text-warm-700">{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>{options.map((option) => { const selected = option.date === selectedDate; return <Pressable key={option.date} disabled={disabled} onPress={() => onSelect(option.date)} className={`min-h-20 min-w-20 items-center justify-center rounded-2xl border px-3 ${selected ? 'border-saffron-500 bg-saffron-50' : 'border-warm-200 bg-white'}`}><Text className="text-[11px] font-bold uppercase text-warm-500">{option.weekday}</Text><Text className={`mt-0.5 text-xl font-extrabold ${selected ? 'text-saffron-700' : 'text-warm-900'}`}>{option.day}</Text><Text className="text-xs font-semibold text-warm-500">{option.month}</Text></Pressable>; })}</ScrollView></View>;
}

interface DateOption { date: string; day: string; month: string; weekday: string }
function startOfToday(): Date { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), today.getDate()); }
function addDays(date: Date, days: number): Date { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function parseDateOnly(value: string): Date { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
function toDateOnly(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function buildDateOptions(startDate: Date, count: number): DateOption[] { return Array.from({ length: count }, (_, index) => { const date = addDays(startDate, index); return { date: toDateOnly(date), day: String(date.getDate()), month: date.toLocaleDateString('en-IN', { month: 'short' }), weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }) }; }); }
function daysBetween(startDate: string, endDate: string): number { return Math.round((parseDateOnly(endDate).getTime() - parseDateOnly(startDate).getTime()) / 86_400_000); }
function resolveIdProofMimeType(fileName: string, suppliedMimeType?: string): GuestIdProofFile['mimeType'] | null { if (allowedIdProofTypes.some((value) => value === suppliedMimeType)) return suppliedMimeType!; const extension = fileName.split('.').pop()?.toLowerCase(); if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'; if (extension === 'png') return 'image/png'; if (extension === 'pdf') return 'application/pdf'; return null; }

function GuestStepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) { return <View className="min-h-20 flex-row items-center rounded-2xl border border-warm-100 bg-white px-4"><Text className="flex-1 text-base font-extrabold text-warm-900">{label}</Text><View className="flex-row items-center gap-3"><Pressable className="h-11 w-11 items-center justify-center rounded-full border border-warm-200" disabled={value <= min} onPress={() => onChange(Math.max(min, value - 1))}><MaterialCommunityIcons color={ui.maroon} name="minus" size={20} /></Pressable><Text className="w-5 text-center font-extrabold text-warm-900">{value}</Text><Pressable className="h-11 w-11 items-center justify-center rounded-full border border-warm-200" disabled={value >= max} onPress={() => onChange(Math.min(max, value + 1))}><MaterialCommunityIcons color={ui.maroon} name="plus" size={20} /></Pressable></View></View>; }

function PaymentOption({ active, icon, label, description, onPress }: { active: boolean; icon: 'cash' | 'qrcode-scan'; label: string; description: string; onPress: () => void }) { return <Pressable className={`min-h-20 flex-row items-center gap-3 rounded-2xl border bg-white p-4 ${active ? 'border-2 border-saffron-500' : 'border-warm-200'}`} onPress={onPress}><View className={`h-12 w-12 items-center justify-center rounded-2xl ${active ? 'bg-saffron-50' : 'bg-warm-100'}`}><MaterialCommunityIcons color={active ? ui.saffronDeep : ui.muted} name={icon} size={24} /></View><View className="flex-1"><Text className="text-base font-extrabold text-warm-900">{label}</Text><Text className="mt-1 text-xs text-warm-500">{description}</Text></View><MaterialCommunityIcons color={active ? ui.saffronDeep : '#D7C8B8'} name={active ? 'radiobox-marked' : 'radiobox-blank'} size={24} /></Pressable>; }
function PriceRow({ label, value }: { label: string; value: string }) { return <View className="mt-4 flex-row items-center justify-between gap-4"><Text className="flex-1 text-sm text-warm-500">{label}</Text><Text className="text-sm font-bold text-warm-900">{value}</Text></View>; }
