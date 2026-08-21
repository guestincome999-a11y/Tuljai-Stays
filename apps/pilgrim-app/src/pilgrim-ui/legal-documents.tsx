import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';

import { ui } from './components';

export type LegalDocumentKind = 'privacy' | 'terms';

export function LegalDocument({ kind }: { kind: LegalDocumentKind }) {
  const isPrivacy = kind === 'privacy';

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="gap-5">
        <View>
          <Text className="text-2xl font-extrabold text-warm-900">
            {isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}
          </Text>
          <Text className="mt-1 text-xs font-semibold text-warm-500">
            Tuljai Stays · India · Effective date: 19 August 2026
          </Text>
        </View>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}
      </View>
    </ScrollView>
  );
}

function Heading({ children }: { children: string }) {
  return <Text className="text-base font-extrabold text-maroon-700">{children}</Text>;
}

function Para({ children }: { children: string }) {
  return <Text className="text-sm leading-6 text-warm-700">{children}</Text>;
}

function Bullet({ children }: { children: string }) {
  return (
    <View className="flex-row gap-2">
      <MaterialCommunityIcons color={ui.saffronDeep} name="circle-small" size={20} />
      <Text className="flex-1 text-sm leading-6 text-warm-700">{children}</Text>
    </View>
  );
}

function PrivacyContent() {
  return (
    <View className="gap-4">
      <Para>
        This Privacy Policy explains how Tuljai Stays collects, uses, shares, stores and protects personal data when you use the Tuljai Stays pilgrim application and related booking services for accommodation in Tuljapur, Maharashtra. It is written for the actual features of the service, including account login, stay search, booking, guest details, government photo-ID proof upload, QR check-in, notifications and online payments.
      </Para>

      <Heading>1. Who we are</Heading>
      <Para>
        Tuljai Stays operates an accommodation-booking platform connecting pilgrims and visitors with participating lodges, bhakt niwases, guest houses and other stays in Tuljapur. Tuljai Stays is not the owner or operator of every listed property. The participating lodge is responsible for the accommodation it provides, subject to the booking terms shown in the app.
      </Para>

      <Heading>2. Personal data we collect</Heading>
      <Bullet>Account data: mobile number and, where used, account/display name and authentication information.</Bullet>
      <Bullet>Booking data: stay selected, room, check-in and check-out dates, number of adults and children, booking status and booking reference.</Bullet>
      <Bullet>Guest data: lead guest name, mobile number, optional email, address or other information you voluntarily provide for a booking.</Bullet>
      <Bullet>Identity data: government photo-ID proof that the booking flow requires for guest verification. We do not ask for an identity document unless it is required by the applicable booking/check-in process.</Bullet>
      <Bullet>Payment data: payment status, order/reference identifiers and payment verification information. Card, UPI and other sensitive payment credentials are processed by the payment provider and are not intentionally stored by Tuljai Stays as full payment credentials.</Bullet>
      <Bullet>Device and notification data: push-notification token, device/platform information and app event information needed to deliver booking and operational notifications.</Bullet>
      <Bullet>Technical data: information reasonably necessary to secure the service, prevent abuse, diagnose errors and maintain reliable operation.</Bullet>
      <Bullet>Saved-stay and preference data: favourites, language and notification preferences associated with your account.</Bullet>

      <Heading>3. Why we use personal data</Heading>
      <Bullet>To create and authenticate your account and provide the booking service you request.</Bullet>
      <Bullet>To check room availability, create booking locks, create bookings and communicate booking status.</Bullet>
      <Bullet>To provide relevant guest information to the participating lodge when needed to fulfil the stay and check-in process.</Bullet>
      <Bullet>To process and verify online payments and reconcile payment status.</Bullet>
      <Bullet>To support QR-based check-in and booking lifecycle operations.</Bullet>
      <Bullet>To send booking confirmations, owner responses, payment updates and check-in or other operational notifications you have enabled.</Bullet>
      <Bullet>To protect the platform, users and participating properties against fraud, abuse, unauthorised access and booking misuse.</Bullet>
      <Bullet>To comply with applicable Indian law, lawful requests and record-keeping obligations.</Bullet>

      <Heading>4. Legal framework</Heading>
      <Para>
        Tuljai Stays is designed to handle personal data in accordance with applicable Indian law, including the Digital Personal Data Protection Act, 2023 and applicable rules made under it, including the Digital Personal Data Protection Rules, 2025 as and when their relevant provisions apply to the service. Consumer-facing booking practices are also intended to respect the Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020, as applicable. Other applicable laws may apply depending on the transaction, payment, identity-verification or security requirement.
      </Para>

      <Heading>5. Notice, consent and your choices</Heading>
      <Para>
        We aim to collect only data reasonably necessary for the stated service. Where consent is the legal basis for processing, consent should be clear, informed and specific to the stated purpose, and you may withdraw consent where the law permits. Withdrawal does not undo processing that was lawful before withdrawal and does not prevent processing that is otherwise required or permitted by law or necessary to complete an existing transaction.
      </Para>

      <Heading>6. Sharing with participating lodges and service providers</Heading>
      <Para>
        A booking may require us to share relevant guest and booking information with the participating lodge so that the lodge can accept, prepare and provide the stay. We may also use service providers for hosting, authentication, storage, communications, analytics/diagnostics, payment processing and other necessary infrastructure. Service providers receive only information reasonably required for their function and are expected to handle it according to applicable contractual and legal requirements.
      </Para>

      <Heading>7. Government ID proof</Heading>
      <Para>
        Government photo-ID proof is treated as sensitive operational information. It is collected only where required by the booking/check-in flow, used for verification and accommodation-related purposes, and access should be limited to authorised personnel and systems. Tuljai Stays should not use identity documents for advertising or unrelated profiling. Where retention is no longer required for the stated purpose, applicable law, dispute handling, fraud prevention or record-keeping, the data should be securely deleted or anonymised in accordance with the applicable retention schedule.
      </Para>

      <Heading>8. Payments</Heading>
      <Para>
        Online payments are processed through the payment gateway made available in the app, including Razorpay where enabled. Tuljai Stays receives payment/order and verification information needed to identify the transaction and update the booking. Full card or UPI authentication credentials should not be stored by Tuljai Stays. Payment disputes, reversals and refunds may also involve the payment provider and the applicable lodge or booking policy.
      </Para>

      <Heading>9. Security</Heading>
      <Para>
        We use reasonable technical and organisational measures appropriate to the nature of the data and service, including access controls, authentication, secure transport, restricted administrative access and operational monitoring. No internet service can guarantee absolute security. If a personal-data breach occurs, Tuljai Stays will follow the notification and remedial requirements applicable to it under Indian law.
      </Para>

      <Heading>10. Retention and deletion</Heading>
      <Para>
        We retain information only for as long as reasonably necessary for the purpose for which it was collected, completion and support of bookings, accounting/payment reconciliation, fraud and security controls, dispute resolution, legal obligations and other lawful purposes. Account or data-deletion requests may be made through Tuljai Stays support. Some information may need to be retained where required by law or reasonably necessary for an existing booking, dispute, security investigation or financial record.
      </Para>

      <Heading>11. Your data rights</Heading>
      <Para>
        Subject to the applicable legal framework and prescribed procedures, you may request access to information about your personal data, correction of inaccurate or incomplete data, deletion where legally available, withdrawal of consent where consent is the basis for processing, and information or grievance support regarding processing. Requests should be made through the support contact shown in the app or on the official Tuljai Stays service. We may need to verify your identity before acting on a request.
      </Para>

      <Heading>12. Children</Heading>
      <Para>
        Accommodation bookings should be made by an adult or by a person acting with the required parent or lawful-guardian authority. Tuljai Stays does not intentionally use children’s personal data for targeted advertising or behavioural monitoring. Where Indian data-protection law requires verifiable parental or lawful-guardian consent for processing a child’s personal data, Tuljai Stays will apply the required safeguards.
      </Para>

      <Heading>13. Changes to this policy</Heading>
      <Para>
        We may update this policy when the service, technology or applicable law changes. Material changes will be communicated through an appropriate in-app or other available notice. The effective date at the top identifies the version currently displayed.
      </Para>

      <Heading>14. Grievance and contact</Heading>
      <Para>
        Privacy or data-related concerns can be raised through the support contact published in the app. We will review and respond to grievances within the timelines required by applicable law. If a matter remains unresolved, you retain any rights and remedies available under applicable Indian law, including applicable consumer or data-protection mechanisms.
      </Para>

      <Para>
        Important: This document is a product-specific privacy notice drafted for Tuljai Stays and should be reviewed against the final legal entity details, actual data flows, retention schedule, contracts and applicable commencement/enforcement dates by an India-qualified lawyer before being treated as the company’s final legal notice.
      </Para>
    </View>
  );
}

function TermsContent() {
  return (
    <View className="gap-4">
      <Para>
        These Terms & Conditions govern your use of Tuljai Stays and bookings made through the platform. By using the app or making a booking, you agree to these terms to the extent permitted by applicable law. Mandatory rights available to consumers under Indian law are not excluded by these terms.
      </Para>

      <Heading>1. What Tuljai Stays provides</Heading>
      <Para>
        Tuljai Stays provides a digital marketplace/booking service that helps pilgrims and visitors discover participating accommodation providers in Tuljapur and submit or complete bookings. Unless the app expressly says otherwise, the actual accommodation is provided by the participating lodge, not by Tuljai Stays itself.
      </Para>

      <Heading>2. Accurate information</Heading>
      <Para>
        You must provide accurate booking, guest and contact information and must not impersonate another person or submit fraudulent identity documents. You are responsible for checking names, dates, guest counts, room selection, price, payment method and applicable lodge rules before confirming a booking.
      </Para>

      <Heading>3. Guest identity and check-in</Heading>
      <Para>
        Where the booking flow requires government photo-ID proof, you must provide a valid document belonging to the relevant guest and must follow lawful check-in requirements. The lodge may verify identity at check-in and may refuse accommodation where lawful identification or other mandatory requirements are not met. Tuljai Stays does not guarantee that a lodge will accept an identity document that is invalid, expired, illegible or inconsistent with the booking.
      </Para>

      <Heading>4. Booking lifecycle</Heading>
      <Bullet>A booking request may remain pending until the lodge accepts it, unless the app identifies the booking as prepaid and automatically confirmed.</Bullet>
      <Bullet>Availability can change before a booking is successfully created or payment is verified.</Bullet>
      <Bullet>A booking reference or QR pass is valid only for the booking and dates shown in the app and may be invalidated after cancellation, rejection, expiry or completion.</Bullet>
      <Bullet>Prepaid booking status depends on successful payment verification and the booking rules shown at checkout.</Bullet>

      <Heading>5. Prices and charges</Heading>
      <Para>
        The price displayed at checkout is the amount applicable to the selected booking based on the information available at that time. Taxes, mandatory charges or other applicable amounts will be shown where available. Tuljai Stays may earn a commission or other agreed commercial fee from participating accommodation providers; such a provider-side commercial arrangement does not by itself create a separate charge to the pilgrim. Any amount payable by the pilgrim must be disclosed in the booking flow.
      </Para>

      <Heading>6. Online payment</Heading>
      <Para>
        Where online payment is enabled, the payment is processed through the payment gateway presented by Tuljai Stays. A successful payment attempt does not by itself permit you to bypass booking verification; the app must show a valid booking/payment status. If payment succeeds but the booking status is not immediately updated, do not make a duplicate payment without first checking the booking/payment status or contacting support.
      </Para>

      <Heading>7. Pay at the lodge</Heading>
      <Para>
        If “Pay at the lodge” is selected, the applicable accommodation amount is paid directly according to the booking and lodge terms. The lodge may require payment before check-in. Tuljai Stays does not take custody of a cash payment made directly to the lodge and cannot be responsible for an amount you voluntarily pay outside the platform unless applicable law provides otherwise.
      </Para>

      <Heading>8. Cancellation, refund and failed payments</Heading>
      <Para>
        Cancellation eligibility, refund amount and timing depend on the cancellation terms shown for the booking and applicable law. Where Tuljai Stays or its payment provider processes a refund, the refund may take additional time to appear in the user’s bank or payment account. A failed, reversed or duplicated payment should be reported promptly with the booking/reference details. Tuljai Stays will not impose a contractual term that unlawfully removes a consumer’s statutory rights.
      </Para>

      <Heading>9. Lodge responsibilities</Heading>
      <Bullet>The participating lodge is responsible for the actual accommodation, room condition, lawful operation of the property and services it promises.</Bullet>
      <Bullet>The lodge is responsible for complying with applicable local laws, licences, safety requirements and guest-check-in requirements applicable to its property.</Bullet>
      <Bullet>The lodge must honour an accepted booking except where a lawful exception, safety issue, force majeure event or other disclosed booking term applies.</Bullet>
      <Bullet>Where Tuljai Stays receives a complaint about a property, it may investigate, restrict listings or take other platform action consistent with its agreements and applicable law.</Bullet>

      <Heading>10. Tuljai Stays responsibilities and limits</Heading>
      <Para>
        Tuljai Stays will use reasonable care to operate the platform, display available information and communicate booking events. We do not guarantee uninterrupted availability of the app, network, payment gateway or every listed property. We are not responsible for matters exclusively within a lodge’s control, such as on-site conduct or facilities, except to the extent that applicable law or an express Tuljai Stays commitment makes us responsible. Nothing in these terms excludes liability that cannot lawfully be excluded.
      </Para>

      <Heading>11. Festival and high-demand periods</Heading>
      <Para>
        Tuljapur may experience unusually high demand, traffic, crowding, transport disruption and limited accommodation during festivals and major pilgrimage periods. Availability and response times may therefore change quickly. These conditions do not remove the consumer rights attached to an accepted booking or applicable refund/cancellation terms.
      </Para>

      <Heading>12. Acceptable use</Heading>
      <Para>
        You must not misuse the app, interfere with its security, create fraudulent bookings, abuse promotions, upload unlawful material, submit another person’s identity document without lawful authority, attempt unauthorised access, or use the service to deceive a lodge, another guest or Tuljai Stays.
      </Para>

      <Heading>13. Account suspension</Heading>
      <Para>
        Tuljai Stays may suspend or restrict an account where reasonably necessary to prevent fraud, security abuse, unlawful activity or serious misuse, or where required by law. Where appropriate, the user will be informed of the reason and any available review/support process. A suspension does not remove rights relating to an existing paid transaction where those rights continue under applicable law.
      </Para>

      <Heading>14. Intellectual property</Heading>
      <Para>
        Tuljai Stays and its authorised licensors retain rights in the app, branding, software, original text, design and other protected content, except for content supplied by users or participating properties. You receive a limited, non-transferable right to use the app for its intended purpose and may not copy, reverse engineer, commercially exploit or misuse protected materials except as permitted by law.
      </Para>

      <Heading>15. Complaints and consumer rights</Heading>
      <Para>
        Complaints should first be raised through the support channel displayed in the app so that Tuljai Stays can investigate and respond. Nothing in these terms prevents a consumer from using remedies available under the Consumer Protection Act, 2019 or other applicable Indian law.
      </Para>

      <Heading>16. Governing law</Heading>
      <Para>
        These terms are governed by the laws of India. Any dispute will be subject to the jurisdiction of competent Indian courts or consumer fora as permitted by applicable law. Where a consumer-protection law provides a mandatory forum or remedy, that statutory right prevails over any inconsistent contractual provision.
      </Para>

      <Heading>17. Changes</Heading>
      <Para>
        Tuljai Stays may update these terms to reflect changes in the service, commercial model or law. Updated terms will be made available in the app. The version applicable to an already-confirmed booking will not be used to retrospectively remove rights that have already accrued under the booking or applicable law.
      </Para>

      <Heading>18. Contact</Heading>
      <Para>
        For booking, payment, cancellation, privacy or other support, use the support phone or email published in the Tuljai Stays app. Please include your booking reference where relevant so the issue can be identified quickly.
      </Para>

      <Para>
        Important: This is a product-specific draft for Tuljai Stays, not a substitute for legal advice. Before public launch, the final document should be reviewed by an India-qualified lawyer against the actual legal entity name, registered address, grievance/contact details, lodge agreements, cancellation/refund rules, payment arrangements, data-retention schedule and the applicable commencement dates of Indian data-protection requirements.
      </Para>
    </View>
  );
}
