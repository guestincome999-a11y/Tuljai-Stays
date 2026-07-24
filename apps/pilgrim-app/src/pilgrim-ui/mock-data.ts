export type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';

export interface PilgrimRoom {
  available: number;
  bed: string;
  capacity: string;
  features: string[];
  id: string;
  name: string;
  price: number;
}

export interface PilgrimLodge {
  amenities: Array<{ icon: string; label: string }>;
  badge?: string;
  description: string;
  distance: string;
  hero: string;
  id: string;
  location: string;
  name: string;
  photos: string[];
  price: number;
  primaryPhone?: string;
  rating: number;
  reviewCount: number;
  rooms: PilgrimRoom[];
  rules: string[];
  slug?: string;
  tags: string[];
  type: 'Bhakt Niwas' | 'Hotel' | 'Guest House' | 'Dharamshala';
}

export interface PilgrimBooking {
  amount: number;
  bookingCode: string;
  checkIn: string;
  checkInDate: string;
  checkOut: string;
  checkOutDate: string;
  checkoutDateFlexible?: boolean;
  guests: string;
  id: string;
  image: string;
  lodgeId: string;
  lodgeName: string;
  paymentStatus: 'Paid' | 'Pay at lodge' | 'Refunded';
  qrReady?: boolean;
  roomName: string;
  status: BookingStatus;
}

export interface PilgrimNotification {
  body: string;
  bookingId?: string;
  id: string;
  read: boolean;
  time: string;
  title: string;
  type: 'booking' | 'offer' | 'temple' | 'payment';
}

const sharedAmenities = [
  { icon: 'wifi', label: 'Free Wi-Fi' },
  { icon: 'car', label: 'Parking' },
  { icon: 'water', label: 'Hot water' },
  { icon: 'shield-check', label: 'CCTV' },
];

export const pilgrimLodges: PilgrimLodge[] = [
  {
    amenities: [
      ...sharedAmenities,
      { icon: 'elevator-passenger', label: 'Lift' },
      { icon: 'food-apple', label: 'Pure veg meals' },
    ],
    badge: 'Most loved',
    description:
      'A peaceful, family-run stay with spotless rooms and a helpful reception team. The temple shuttle leaves every 30 minutes during the morning darshan rush.',
    distance: '450 m from temple',
    hero: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=82',
    id: 'tuljai-darshan',
    location: 'Bhavani Road, Tuljapur',
    name: 'Tuljai Darshan Residency',
    photos: [
      'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=82',
    ],
    price: 1499,
    rating: 4.8,
    reviewCount: 286,
    rooms: [
      {
        available: 3,
        bed: '1 queen bed',
        capacity: '2 adults + 1 child',
        features: ['Air conditioned', 'Attached bathroom', 'Temple-view window'],
        id: 'td-deluxe',
        name: 'Deluxe Family Room',
        price: 1899,
      },
      {
        available: 5,
        bed: '1 double bed',
        capacity: '2 adults',
        features: ['Air cooled', 'Attached bathroom', '24-hour hot water'],
        id: 'td-standard',
        name: 'Standard Double Room',
        price: 1499,
      },
    ],
    rules: ['Government photo ID required', 'Check-in from 12:00 PM', 'No alcohol or smoking'],
    tags: ['Verified', 'Family friendly', 'Free cancellation'],
    type: 'Hotel',
  },
  {
    amenities: [
      ...sharedAmenities,
      { icon: 'silverware-fork-knife', label: 'Dining hall' },
      { icon: 'wheelchair-accessibility', label: 'Accessible' },
    ],
    badge: 'Closest to temple',
    description:
      'A trusted Bhakt Niwas designed for pilgrims, with a quiet prayer hall, simple vegetarian food and priority assistance for senior citizens.',
    distance: '280 m from temple',
    hero: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=82',
    id: 'bhavani-bhakt',
    location: 'Temple Gate Road, Tuljapur',
    name: 'Bhavani Bhakt Niwas',
    photos: [
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=82',
    ],
    price: 899,
    rating: 4.7,
    reviewCount: 418,
    rooms: [
      {
        available: 8,
        bed: '2 single beds',
        capacity: '2 adults',
        features: ['Fan cooled', 'Attached bathroom', 'Prayer kit on request'],
        id: 'bb-twin',
        name: 'Bhakt Twin Room',
        price: 899,
      },
      {
        available: 4,
        bed: '2 double beds',
        capacity: '4 adults + 1 child',
        features: ['Air cooled', 'Large family room', 'Ground floor option'],
        id: 'bb-family',
        name: 'Family Seva Room',
        price: 1599,
      },
    ],
    rules: [
      'Government photo ID required',
      'Quiet hours after 10:00 PM',
      'Pure vegetarian premises',
    ],
    tags: ['Verified', 'Senior friendly', 'Meals available'],
    type: 'Bhakt Niwas',
  },
  {
    amenities: [
      ...sharedAmenities,
      { icon: 'air-conditioner', label: 'Air conditioning' },
      { icon: 'room-service-outline', label: 'Room service' },
    ],
    description:
      'Comfortable modern rooms on the main Solapur road, ideal for families arriving by car. Early breakfast and luggage storage are available.',
    distance: '1.2 km from temple',
    hero: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82',
    id: 'yatri-comfort',
    location: 'Solapur Road, Tuljapur',
    name: 'Yatri Comfort Inn',
    photos: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=82',
    ],
    price: 1299,
    rating: 4.6,
    reviewCount: 164,
    rooms: [
      {
        available: 6,
        bed: '1 king bed',
        capacity: '2 adults + 1 child',
        features: ['Air conditioned', 'Breakfast included', 'Extra mattress available'],
        id: 'yc-premium',
        name: 'Premium King Room',
        price: 1699,
      },
      {
        available: 2,
        bed: '1 double bed',
        capacity: '2 adults',
        features: ['Air cooled', 'Attached bathroom', 'Road-facing room'],
        id: 'yc-comfort',
        name: 'Comfort Double',
        price: 1299,
      },
    ],
    rules: ['Government photo ID required', 'Check-in from 1:00 PM', 'Pets are not permitted'],
    tags: ['Verified', 'Breakfast', 'Parking'],
    type: 'Hotel',
  },
  {
    amenities: [
      ...sharedAmenities,
      { icon: 'account-group', label: 'Family rooms' },
      { icon: 'washing-machine', label: 'Laundry' },
    ],
    description:
      'A warm guest house with spacious family rooms, a shared terrace and local hosts who can help arrange temple visits and nearby transport.',
    distance: '800 m from temple',
    hero: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=82',
    id: 'ambai-guest',
    location: 'Friday Peth, Tuljapur',
    name: 'Ambai Family Guest House',
    photos: [
      'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1200&q=82',
    ],
    price: 1099,
    rating: 4.5,
    reviewCount: 97,
    rooms: [
      {
        available: 4,
        bed: '1 double + 1 single bed',
        capacity: '3 adults + 1 child',
        features: ['Air cooled', 'Private balcony', 'Extra mattress available'],
        id: 'ag-family',
        name: 'Family Triple Room',
        price: 1399,
      },
      {
        available: 3,
        bed: '1 double bed',
        capacity: '2 adults',
        features: ['Fan cooled', 'Attached bathroom', 'Upper floor'],
        id: 'ag-double',
        name: 'Classic Double',
        price: 1099,
      },
    ],
    rules: ['Government photo ID required', 'Check-in from 11:00 AM', 'Please observe quiet hours'],
    tags: ['Verified', 'Local host', 'Family rooms'],
    type: 'Guest House',
  },
  {
    amenities: [
      { icon: 'water', label: 'Hot water' },
      { icon: 'shield-check', label: 'CCTV' },
      { icon: 'silverware-fork-knife', label: 'Community meals' },
      { icon: 'shoe-print', label: 'Walk to temple' },
    ],
    description:
      'Simple and clean community accommodation for budget-conscious pilgrims, within walking distance of the main temple queue entrance.',
    distance: '650 m from temple',
    hero: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=82',
    id: 'maharashtra-seva',
    location: 'Arya Chowk, Tuljapur',
    name: 'Maharashtra Seva Dharamshala',
    photos: [
      'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=82',
    ],
    price: 699,
    rating: 4.4,
    reviewCount: 231,
    rooms: [
      {
        available: 12,
        bed: '2 single beds',
        capacity: '2 adults',
        features: ['Fan cooled', 'Shared washroom', 'Locker included'],
        id: 'ms-seva',
        name: 'Seva Twin Room',
        price: 699,
      },
    ],
    rules: [
      'Government photo ID required',
      'Temple-town decorum expected',
      'Pure vegetarian premises',
    ],
    tags: ['Budget pick', 'Community stay', 'Walkable'],
    type: 'Dharamshala',
  },
];

export const initialPilgrimBookings: PilgrimBooking[] = [
  {
    amount: 3798,
    bookingCode: 'TS-261018-8421',
    checkIn: '18 Oct 2026',
    checkInDate: '2026-10-18',
    checkOut: '20 Oct 2026',
    checkOutDate: '2026-10-20',
    guests: '2 adults · 1 child',
    id: 'booking-upcoming',
    image: pilgrimLodges[0].hero,
    lodgeId: pilgrimLodges[0].id,
    lodgeName: pilgrimLodges[0].name,
    paymentStatus: 'Paid',
    qrReady: true,
    roomName: 'Deluxe Family Room',
    status: 'confirmed',
  },
  {
    amount: 899,
    bookingCode: 'TS-260724-1935',
    checkIn: '24 Jul 2026',
    checkInDate: '2026-07-24',
    checkOut: '25 Jul 2026',
    checkOutDate: '2026-07-25',
    guests: '2 adults',
    id: 'booking-pending',
    image: pilgrimLodges[1].hero,
    lodgeId: pilgrimLodges[1].id,
    lodgeName: pilgrimLodges[1].name,
    paymentStatus: 'Pay at lodge',
    roomName: 'Bhakt Twin Room',
    status: 'pending',
  },
  {
    amount: 2598,
    bookingCode: 'TS-260203-5172',
    checkIn: '3 Feb 2026',
    checkInDate: '2026-02-03',
    checkOut: '5 Feb 2026',
    checkOutDate: '2026-02-05',
    guests: '2 adults',
    id: 'booking-completed',
    image: pilgrimLodges[2].hero,
    lodgeId: pilgrimLodges[2].id,
    lodgeName: pilgrimLodges[2].name,
    paymentStatus: 'Paid',
    roomName: 'Comfort Double',
    status: 'completed',
  },
];

export const initialPilgrimNotifications: PilgrimNotification[] = [
  {
    body: 'Your room is reserved. Your QR check-in pass is now ready.',
    bookingId: 'booking-upcoming',
    id: 'notification-1',
    read: false,
    time: '12 min ago',
    title: 'Booking confirmed',
    type: 'booking',
  },
  {
    body: 'Special Navratri darshan queues will open from 4:00 AM. Plan extra travel time.',
    id: 'notification-2',
    read: false,
    time: '2 hr ago',
    title: 'Temple travel update',
    type: 'temple',
  },
  {
    body: 'Payment of ₹3,798 was received successfully for Tuljai Darshan Residency.',
    id: 'notification-3',
    read: true,
    time: 'Yesterday',
    title: 'Payment received',
    type: 'payment',
  },
  {
    body: 'Book before 31 July and get free cancellation on selected family rooms.',
    id: 'notification-4',
    read: true,
    time: '2 days ago',
    title: 'Early Navratri offer',
    type: 'offer',
  },
];

export function formatRupees(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}
