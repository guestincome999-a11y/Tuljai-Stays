import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';

export type LegalDocumentKind = 'privacy' | 'terms';

const SAFFRON_DEEP = '#A64F12';

export function LegalDocument({ kind }: { kind: LegalDocumentKind }) {
  const isPrivacy = kind === 'privacy';

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="gap-5">
        <View>
          <Text className="font-heading text-2xl font-extrabold text-warm-900">
            {isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}
          </Text>
          <Text className="mt-1 font-body text-xs font-semibold text-warm-500">
            Tuljai Stays Owner App is operated by Shri Tuljabhavani Technologies, Tuljapur,
            Maharashtra, India · Effective date: 29 August 2026
          </Text>
        </View>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}
      </View>
    </ScrollView>
  );
}

function Heading({ children }: { children: string }) {
  return <Text className="font-heading text-base font-extrabold text-maroon-700">{children}</Text>;
}

function Para({ children }: { children: string }) {
  return <Text className="font-body text-sm leading-6 text-warm-700">{children}</Text>;
}

function Bullet({ children }: { children: string }) {
  return (
    <View className="flex-row gap-2">
      <MaterialCommunityIcons color={SAFFRON_DEEP} name="circle-small" size={20} />
      <Text className="flex-1 font-body text-sm leading-6 text-warm-700">{children}</Text>
    </View>
  );
}

function PrivacyContent() {
  return (
    <View className="gap-4">
      <Para>
        This Privacy Policy explains how the Tuljai Stays Owner App collects, uses, shares, stores
        and protects personal data belonging to lodge owners and their staff when managing lodges,
        rooms, bookings and guest check-in on the platform.
      </Para>

      <Heading>1. Who we are</Heading>
      <Para>
        Tuljai Stays is operated by Shri Tuljabhavani Technologies, based in Tuljapur, Maharashtra,
        India (&quot;Tuljai Stays&quot;, &quot;we&quot;, &quot;us&quot;). The Owner App is provided
        to approved lodge owners so they can manage their listed property on the Tuljai Stays
        platform.
      </Para>

      <Heading>2. Personal data we collect</Heading>
      <Bullet>
        Account data: mobile number and, where used, owner/display name and authentication
        information.
      </Bullet>
      <Bullet>
        Lodge and room data: lodge details, room types, pricing, availability, photos and status you
        enter or upload to manage your listing.
      </Bullet>
      <Bullet>
        Guest data received through bookings: lead guest name, mobile number and booking details
        that are shared with you only after a booking is made or accepted, so that you can fulfil
        the stay and complete check-in.
      </Bullet>
      <Bullet>
        QR check-in data: verification results produced when you scan a pilgrim&apos;s booking QR
        code at check-in.
      </Bullet>
      <Bullet>
        Device and notification data: push-notification token, device/platform information and app
        event information needed to deliver booking alerts.
      </Bullet>
      <Bullet>
        Technical data: information reasonably necessary to secure the service, prevent abuse,
        diagnose errors and maintain reliable operation.
      </Bullet>

      <Heading>3. Why we use personal data</Heading>
      <Bullet>To create and authenticate your owner account and grant access to your lodge.</Bullet>
      <Bullet>
        To let you manage rooms, pricing, availability and photos, and to display your listing to
        pilgrims.
      </Bullet>
      <Bullet>
        To route booking requests to you, share the guest information needed to accept and fulfil a
        booking, and support QR check-in and checkout.
      </Bullet>
      <Bullet>
        To send booking alerts, operational notifications and platform updates you have enabled.
      </Bullet>
      <Bullet>
        To protect the platform, guests and participating properties against fraud, abuse and
        unauthorised access.
      </Bullet>
      <Bullet>To comply with applicable Indian law, lawful requests and record-keeping obligations.</Bullet>

      <Heading>4. Legal framework</Heading>
      <Para>
        Tuljai Stays is designed to handle personal data in accordance with applicable Indian law,
        including the Digital Personal Data Protection Act, 2023 and applicable rules made under it,
        as and when their relevant provisions apply to the service.
      </Para>

      <Heading>5. Guest data you receive as an owner</Heading>
      <Para>
        Guest contact and identity information shared with you through the app is provided solely so
        you can prepare for and fulfil an accepted booking and complete lawful check-in. You must
        not use it for any other purpose, including marketing, and must not share it outside the
        booking relationship except where the guest, the law or the platform&apos;s check-in process
        requires it.
      </Para>

      <Heading>6. Sharing with the platform and service providers</Heading>
      <Para>
        We use service providers for hosting, authentication, storage, communications,
        analytics/diagnostics, and other necessary infrastructure. Service providers receive only
        information reasonably required for their function and are expected to handle it according
        to applicable contractual and legal requirements.
      </Para>

      <Heading>7. Security</Heading>
      <Para>
        We use reasonable technical and organisational measures appropriate to the nature of the
        data and service, including access controls, authentication, secure transport, restricted
        administrative access and operational monitoring. No internet service can guarantee absolute
        security.
      </Para>

      <Heading>8. Retention and deletion</Heading>
      <Para>
        We retain information only for as long as reasonably necessary for the purpose for which it
        was collected, completion and support of bookings, dispute resolution, legal obligations and
        other lawful purposes. Account or data-deletion requests may be made through Tuljai Stays
        support. Some information may need to be retained where required by law or reasonably
        necessary for an existing booking, dispute or security investigation.
      </Para>

      <Heading>9. Your data rights</Heading>
      <Para>
        Subject to the applicable legal framework and prescribed procedures, you may request access
        to information about your personal data, correction of inaccurate or incomplete data,
        deletion where legally available, and information or grievance support regarding processing.
        We may need to verify your identity before acting on a request.
      </Para>

      <Heading>10. Changes to this policy</Heading>
      <Para>
        We may update this policy when the service, technology or applicable law changes. Material
        changes will be communicated through an appropriate in-app or other available notice.
      </Para>

      <Heading>11. Grievance and contact</Heading>
      <Para>
        Privacy or data-related concerns can be raised at tuljaistays@gmail.com. We typically reply
        within 4 to 24 hours.
      </Para>

      <Para>
        Important: This document is a product-specific privacy notice drafted for the Tuljai Stays
        Owner App and should be reviewed against actual data flows, the finalised retention
        schedule, owner agreements and applicable commencement/enforcement dates by an
        India-qualified lawyer before being treated as the company&apos;s final legal notice.
      </Para>
    </View>
  );
}

function TermsContent() {
  return (
    <View className="gap-4">
      <Para>
        These Terms & Conditions govern your use of the Tuljai Stays Owner App as an approved lodge
        owner on the platform. By using the app, you agree to these terms to the extent permitted by
        applicable law.
      </Para>

      <Heading>1. Eligibility</Heading>
      <Para>
        Access to the Owner App is granted only after your lodge has been approved by Tuljai Stays
        operations. You must use the mobile number registered with your approved owner account.
      </Para>

      <Heading>2. Accurate listing information</Heading>
      <Para>
        You must keep your lodge details, room types, pricing, availability, photos and status
        accurate and up to date. Photos must genuinely represent the property and must not be
        misleading or duplicated. Listings remain subject to Tuljai Stays approval.
      </Para>

      <Heading>3. Booking responsibilities</Heading>
      <Bullet>
        Accept a booking request only when the room is genuinely available, and reject promptly with
        a clear reason when it is not.
      </Bullet>
      <Bullet>
        Honour an accepted booking except where a lawful exception, safety issue, force majeure event
        or other disclosed booking term applies.
      </Bullet>
      <Bullet>
        Keep the Owner App reachable during operating hours so booking alerts can be actioned
        promptly.
      </Bullet>

      <Heading>4. Guest check-in and QR scanning</Heading>
      <Para>
        Scan a pilgrim&apos;s booking QR code only after a booking has been approved, and rely on the
        app&apos;s backend verification result rather than the raw QR content. Complete the guest
        register after a successful QR check-in. Guest contact details made available to you through
        check-in must be used only for that stay.
      </Para>

      <Heading>5. Pricing, commission and pay-at-lodge amounts</Heading>
      <Para>
        You are responsible for the room prices you set, subject to any platform pricing rules shown
        in the app. Tuljai Stays may earn a commission or other agreed commercial fee on bookings
        made through the platform. Where a guest pays directly at the lodge, you are responsible for
        collecting that amount according to the booking terms.
      </Para>

      <Heading>6. Property standards and compliance</Heading>
      <Bullet>
        You are responsible for the actual accommodation, room condition and lawful operation of your
        property.
      </Bullet>
      <Bullet>
        You are responsible for complying with applicable local laws, licences, safety requirements
        and guest check-in requirements applicable to your property.
      </Bullet>

      <Heading>7. Platform role and limits</Heading>
      <Para>
        Tuljai Stays provides the booking platform connecting your lodge with pilgrims and visitors.
        We do not guarantee uninterrupted availability of the app, network or payment gateway. We are
        not responsible for matters exclusively within your control, such as on-site conduct or
        facilities, except to the extent applicable law or an express Tuljai Stays commitment makes
        us responsible.
      </Para>

      <Heading>8. Acceptable use</Heading>
      <Para>
        You must not misuse the app, interfere with its security, create fraudulent bookings or
        listings, upload unlawful or misleading material, attempt unauthorised access, or use guest
        data made available to you for any purpose outside fulfilling an accepted booking.
      </Para>

      <Heading>9. Account suspension</Heading>
      <Para>
        Tuljai Stays may suspend or restrict your account or listing where reasonably necessary to
        prevent fraud, security abuse, unlawful activity, serious misuse or a substantiated guest
        complaint, or where required by law. Where appropriate, you will be informed of the reason
        and any available review process.
      </Para>

      <Heading>10. Complaints and disputes</Heading>
      <Para>
        Complaints should first be raised through the support channel below so that Tuljai Stays can
        investigate and respond.
      </Para>

      <Heading>11. Governing law</Heading>
      <Para>
        These terms are governed by the laws of India. Any dispute will be subject to the
        jurisdiction of the competent courts at Tuljapur, Maharashtra, or such other Indian forum as
        applicable law permits or requires.
      </Para>

      <Heading>12. Changes</Heading>
      <Para>
        Tuljai Stays may update these terms to reflect changes in the service, commercial model or
        law. Updated terms will be made available in the app.
      </Para>

      <Heading>13. Contact</Heading>
      <Para>
        For account, booking, listing or other support, email tuljaistays@gmail.com. We typically
        reply within 4 to 24 hours.
      </Para>

      <Para>
        Important: This is a product-specific draft for the Tuljai Stays Owner App, not a substitute
        for legal advice. Before public launch, the final document should be reviewed by an
        India-qualified lawyer against the actual owner/lodge agreements, commission terms and the
        applicable commencement dates of Indian data-protection requirements.
      </Para>
    </View>
  );
}

// Note on Data Processing Agreements: lodge owners use the Owner App as platform users operating
// under these Terms, not as separate customers who contract Tuljai Stays to process data on their
// behalf as an independent controller. No DPA is offered at this time. Revisit if a future
// commercial arrangement makes an owner a distinct data controller (e.g. an enterprise/chain
// owner with its own privacy obligations toward guests).
