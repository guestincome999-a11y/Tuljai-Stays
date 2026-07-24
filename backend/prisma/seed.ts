import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AmenityCategory, PropertyType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/tuljai_stays?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const defaultAmenities: Array<{
  category: AmenityCategory;
  iconName: string;
  name: string;
  slug: string;
}> = [
  { category: 'ROOM', iconName: 'air-conditioner', name: 'AC', slug: 'ac' },
  { category: 'ROOM', iconName: 'fan', name: 'Non-AC', slug: 'non-ac' },
  { category: 'ROOM', iconName: 'water', name: 'Hot Water', slug: 'hot-water' },
  { category: 'PARKING', iconName: 'car', name: 'Parking', slug: 'parking' },
  { category: 'FAMILY', iconName: 'account-group', name: 'Family Friendly', slug: 'family-friendly' },
  { category: 'SAFETY', iconName: 'cctv', name: 'CCTV', slug: 'cctv' },
  { category: 'ACCESSIBILITY', iconName: 'elevator-passenger', name: 'Lift', slug: 'lift' },
  { category: 'PROPERTY', iconName: 'wifi', name: 'WiFi', slug: 'wifi' },
  { category: 'FOOD', iconName: 'silverware-fork-knife', name: 'Restaurant', slug: 'restaurant' },
  { category: 'PROPERTY', iconName: 'lightning-bolt', name: 'Generator Backup', slug: 'generator-backup' },
];

interface DemoRoomType {
  adults: number;
  children: number;
  description: string;
  name: string;
  price: number;
  rooms: number;
  slug: string;
}

interface DemoLodge {
  addressLine1: string;
  amenities: string[];
  description: string;
  distance: number;
  name: string;
  ownerName: string;
  ownerPhone: string;
  photos: string[];
  pincode: string;
  propertyType: PropertyType;
  roomTypes: DemoRoomType[];
  rules: string[];
  slug: string;
}

const demoLodges: DemoLodge[] = [
  {
    addressLine1: 'Bhavani Road',
    amenities: ['wifi', 'parking', 'hot-water', 'cctv', 'lift', 'restaurant', 'family-friendly'],
    description:
      'A peaceful, family-run stay with spotless rooms and a helpful reception team. The temple shuttle leaves every 30 minutes during the morning darshan rush.',
    distance: 450,
    name: 'Tuljai Darshan Residency',
    ownerName: 'Mahesh Patil',
    ownerPhone: '+919876500001',
    photos: [
      'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=82',
    ],
    pincode: '413601',
    propertyType: 'HOTEL',
    roomTypes: [
      {
        adults: 2,
        children: 1,
        description: '1 queen bed · Air conditioned · Attached bathroom · Temple-view window',
        name: 'Deluxe Family Room',
        price: 1899,
        rooms: 3,
        slug: 'deluxe-family-room',
      },
      {
        adults: 2,
        children: 0,
        description: '1 double bed · Air cooled · Attached bathroom · 24-hour hot water',
        name: 'Standard Double Room',
        price: 1499,
        rooms: 5,
        slug: 'standard-double-room',
      },
    ],
    rules: ['Government photo ID required', 'Check-in from 12:00 PM', 'No alcohol or smoking'],
    slug: 'tuljai-darshan',
  },
  {
    addressLine1: 'Temple Gate Road',
    amenities: ['wifi', 'parking', 'hot-water', 'cctv', 'restaurant', 'family-friendly'],
    description:
      'A trusted Bhakt Niwas designed for pilgrims, with a quiet prayer hall, simple vegetarian food and priority assistance for senior citizens.',
    distance: 280,
    name: 'Bhavani Bhakt Niwas',
    ownerName: 'Sunita Jadhav',
    ownerPhone: '+919876500002',
    photos: [
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=82',
    ],
    pincode: '413601',
    propertyType: 'BHAKT_NIWAS',
    roomTypes: [
      {
        adults: 2,
        children: 0,
        description: '2 single beds · Fan cooled · Attached bathroom · Prayer kit on request',
        name: 'Bhakt Twin Room',
        price: 899,
        rooms: 8,
        slug: 'bhakt-twin-room',
      },
      {
        adults: 4,
        children: 1,
        description: '2 double beds · Air cooled · Large family room · Ground floor option',
        name: 'Family Seva Room',
        price: 1599,
        rooms: 4,
        slug: 'family-seva-room',
      },
    ],
    rules: ['Government photo ID required', 'Quiet hours after 10:00 PM', 'Pure vegetarian premises'],
    slug: 'bhavani-bhakt',
  },
  {
    addressLine1: 'Solapur Road',
    amenities: ['wifi', 'parking', 'hot-water', 'cctv', 'ac', 'restaurant'],
    description:
      'Comfortable modern rooms on the main Solapur road, ideal for families arriving by car. Early breakfast and luggage storage are available.',
    distance: 1200,
    name: 'Yatri Comfort Inn',
    ownerName: 'Rajendra Shinde',
    ownerPhone: '+919876500003',
    photos: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=82',
    ],
    pincode: '413601',
    propertyType: 'HOTEL',
    roomTypes: [
      {
        adults: 2,
        children: 1,
        description: '1 king bed · Air conditioned · Breakfast included · Extra mattress available',
        name: 'Premium King Room',
        price: 1699,
        rooms: 6,
        slug: 'premium-king-room',
      },
      {
        adults: 2,
        children: 0,
        description: '1 double bed · Air cooled · Attached bathroom · Road-facing room',
        name: 'Comfort Double',
        price: 1299,
        rooms: 2,
        slug: 'comfort-double',
      },
    ],
    rules: ['Government photo ID required', 'Check-in from 1:00 PM', 'Pets are not permitted'],
    slug: 'yatri-comfort',
  },
  {
    addressLine1: 'Friday Peth',
    amenities: ['wifi', 'parking', 'hot-water', 'cctv', 'family-friendly'],
    description:
      'A warm guest house with spacious family rooms, a shared terrace and local hosts who can help arrange temple visits and nearby transport.',
    distance: 800,
    name: 'Ambai Family Guest House',
    ownerName: 'Asha Deshmukh',
    ownerPhone: '+919876500004',
    photos: [
      'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1200&q=82',
    ],
    pincode: '413601',
    propertyType: 'HOMESTAY',
    roomTypes: [
      {
        adults: 3,
        children: 1,
        description: '1 double + 1 single bed · Air cooled · Private balcony · Extra mattress available',
        name: 'Family Triple Room',
        price: 1399,
        rooms: 4,
        slug: 'family-triple-room',
      },
      {
        adults: 2,
        children: 0,
        description: '1 double bed · Fan cooled · Attached bathroom · Upper floor',
        name: 'Classic Double',
        price: 1099,
        rooms: 3,
        slug: 'classic-double',
      },
    ],
    rules: ['Government photo ID required', 'Check-in from 11:00 AM', 'Please observe quiet hours'],
    slug: 'ambai-guest',
  },
  {
    addressLine1: 'Arya Chowk',
    amenities: ['hot-water', 'cctv', 'restaurant', 'non-ac'],
    description:
      'Simple and clean community accommodation for budget-conscious pilgrims, within walking distance of the main temple queue entrance.',
    distance: 650,
    name: 'Maharashtra Seva Dharamshala',
    ownerName: 'Vijay Kulkarni',
    ownerPhone: '+919876500005',
    photos: [
      'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=82',
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=82',
    ],
    pincode: '413601',
    propertyType: 'DHARAMSHALA',
    roomTypes: [
      {
        adults: 2,
        children: 0,
        description: '2 single beds · Fan cooled · Shared washroom · Locker included',
        name: 'Seva Twin Room',
        price: 699,
        rooms: 12,
        slug: 'seva-twin-room',
      },
    ],
    rules: ['Government photo ID required', 'Temple-town decorum expected', 'Pure vegetarian premises'],
    slug: 'maharashtra-seva',
  },
];

async function seedLodge(
  demo: DemoLodge,
  index: number,
  cityId: string,
  amenityIds: Map<string, string>,
): Promise<{ id: string; roomTypeIds: string[] }> {
  const owner = await prisma.user.upsert({
    create: { displayName: demo.ownerName, phoneNumber: demo.ownerPhone, roles: ['OWNER'] },
    update: { displayName: demo.ownerName, isActive: true, roles: ['OWNER'] },
    where: { phoneNumber: demo.ownerPhone },
  });
  const lodge = await prisma.lodge.upsert({
    create: {
      checkInTime: '12:00',
      checkOutTime: '10:00',
      cityId,
      description: demo.description,
      distanceFromTempleMeters: demo.distance,
      isActive: true,
      name: demo.name,
      ownerUserId: owner.id,
      primaryPhone: demo.ownerPhone,
      propertyType: demo.propertyType,
      rules: demo.rules.join('\n'),
      slug: demo.slug,
      status: 'VERIFIED',
      verificationStatus: 'VERIFIED',
      whatsappNumber: demo.ownerPhone,
    },
    update: {
      checkInTime: '12:00',
      checkOutTime: '10:00',
      deletedAt: null,
      description: demo.description,
      distanceFromTempleMeters: demo.distance,
      isActive: true,
      name: demo.name,
      ownerUserId: owner.id,
      primaryPhone: demo.ownerPhone,
      propertyType: demo.propertyType,
      rules: demo.rules.join('\n'),
      status: 'VERIFIED',
      verificationStatus: 'VERIFIED',
      whatsappNumber: demo.ownerPhone,
    },
    where: { cityId_slug: { cityId, slug: demo.slug } },
  });

  await prisma.lodgeOwner.upsert({
    create: {
      isActive: true,
      isPrimary: true,
      lodgeId: lodge.id,
      ownerName: demo.ownerName,
      ownerPhone: demo.ownerPhone,
      roleTitle: 'Owner',
      userId: owner.id,
    },
    update: { deletedAt: null, isActive: true, isPrimary: true, ownerName: demo.ownerName },
    where: { lodgeId_userId: { lodgeId: lodge.id, userId: owner.id } },
  });
  await prisma.lodgeAddress.upsert({
    create: {
      addressLine1: demo.addressLine1,
      city: 'Tuljapur',
      country: 'India',
      district: 'Dharashiv',
      lodgeId: lodge.id,
      pincode: demo.pincode,
      state: 'Maharashtra',
    },
    update: {
      addressLine1: demo.addressLine1,
      city: 'Tuljapur',
      country: 'India',
      district: 'Dharashiv',
      pincode: demo.pincode,
      state: 'Maharashtra',
    },
    where: { lodgeId: lodge.id },
  });

  for (const slug of demo.amenities) {
    const amenityId = amenityIds.get(slug);
    if (amenityId) {
      await prisma.lodgeAmenity.upsert({
        create: { amenityId, lodgeId: lodge.id },
        update: {},
        where: { lodgeId_amenityId: { amenityId, lodgeId: lodge.id } },
      });
    }
  }

  const roomTypeIds: string[] = [];
  for (const [roomTypeIndex, roomType] of demo.roomTypes.entries()) {
    const createdRoomType = await prisma.roomType.upsert({
      create: {
        basePrice: roomType.price,
        capacityAdults: roomType.adults,
        capacityChildren: roomType.children,
        description: roomType.description,
        festivalPrice: Math.round(roomType.price * 1.2),
        isActive: true,
        lodgeId: lodge.id,
        name: roomType.name,
        slug: roomType.slug,
        totalRooms: roomType.rooms,
      },
      update: {
        basePrice: roomType.price,
        capacityAdults: roomType.adults,
        capacityChildren: roomType.children,
        deletedAt: null,
        description: roomType.description,
        festivalPrice: Math.round(roomType.price * 1.2),
        isActive: true,
        name: roomType.name,
        totalRooms: roomType.rooms,
      },
      where: { lodgeId_slug: { lodgeId: lodge.id, slug: roomType.slug } },
    });
    roomTypeIds.push(createdRoomType.id);
    for (let roomIndex = 1; roomIndex <= roomType.rooms; roomIndex += 1) {
      const roomNumber = `${index + 1}${roomTypeIndex + 1}${String(roomIndex).padStart(2, '0')}`;
      await prisma.room.upsert({
        create: {
          floor: roomIndex <= 4 ? 'Ground' : 'First',
          isActive: true,
          lodgeId: lodge.id,
          roomNumber,
          roomTypeId: createdRoomType.id,
          status: 'AVAILABLE',
        },
        update: { deletedAt: null, isActive: true, roomTypeId: createdRoomType.id },
        where: { lodgeId_roomNumber: { lodgeId: lodge.id, roomNumber } },
      });
    }
  }

  for (const [photoIndex, fileUrl] of demo.photos.entries()) {
    const photoId = `10000000-0000-4000-8${index}00-${String(photoIndex + 1).padStart(12, '0')}`;
    await prisma.lodgePhoto.upsert({
      create: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        category: photoIndex === 0 ? 'COVER' : 'ROOM',
        fileUrl,
        id: photoId,
        isCover: photoIndex === 0,
        lodgeId: lodge.id,
        sortOrder: photoIndex,
        thumbnailUrl: fileUrl,
        uploadedByUserId: owner.id,
      },
      update: {
        approvalStatus: 'APPROVED',
        deletedAt: null,
        fileUrl,
        isCover: photoIndex === 0,
        sortOrder: photoIndex,
        thumbnailUrl: fileUrl,
      },
      where: { id: photoId },
    });
  }

  return { id: lodge.id, roomTypeIds };
}

async function main(): Promise<void> {
  await prisma.user.upsert({
    create: {
      displayName: 'Tuljai Operations',
      phoneNumber: '+919876500000',
      roles: ['ADMIN'],
    },
    update: { displayName: 'Tuljai Operations', isActive: true, roles: ['ADMIN'] },
    where: { phoneNumber: '+919876500000' },
  });

  const city = await prisma.city.upsert({
    create: { country: 'India', name: 'Tuljapur', slug: 'tuljapur', state: 'Maharashtra' },
    update: { country: 'India', deletedAt: null, isActive: true, name: 'Tuljapur', state: 'Maharashtra' },
    where: { slug: 'tuljapur' },
  });

  const amenityIds = new Map<string, string>();
  for (const amenity of defaultAmenities) {
    const saved = await prisma.amenity.upsert({
      create: amenity,
      update: {
        category: amenity.category,
        deletedAt: null,
        iconName: amenity.iconName,
        isActive: true,
        name: amenity.name,
      },
      where: { slug: amenity.slug },
    });
    amenityIds.set(saved.slug, saved.id);
  }

  const seededLodges = [];
  for (const [index, lodge] of demoLodges.entries()) {
    seededLodges.push(await seedLodge(lodge, index, city.id, amenityIds));
  }

  const pilgrim = await prisma.user.upsert({
    create: { displayName: 'Anjali Kulkarni', phoneNumber: '+919876543210', roles: ['PILGRIM'] },
    update: { displayName: 'Anjali Kulkarni', isActive: true, roles: ['PILGRIM'] },
    where: { phoneNumber: '+919876543210' },
  });

  const samples = [
    {
      amount: 3798,
      bookingCode: 'TS-261018-8421',
      checkInDate: new Date('2026-10-18T00:00:00.000Z'),
      checkOutDate: new Date('2026-10-20T00:00:00.000Z'),
      lodgeIndex: 0,
      paymentStatus: 'FULLY_PAID' as const,
      roomTypeIndex: 0,
      status: 'ACCEPTED' as const,
    },
    {
      amount: 899,
      bookingCode: 'TS-260724-1935',
      checkInDate: new Date('2026-07-24T00:00:00.000Z'),
      checkOutDate: new Date('2026-07-25T00:00:00.000Z'),
      lodgeIndex: 1,
      paymentStatus: 'PAY_AT_LODGE' as const,
      roomTypeIndex: 0,
      status: 'PENDING_OWNER_APPROVAL' as const,
    },
    {
      amount: 2598,
      bookingCode: 'TS-260203-5172',
      checkInDate: new Date('2026-02-03T00:00:00.000Z'),
      checkOutDate: new Date('2026-02-05T00:00:00.000Z'),
      lodgeIndex: 2,
      paymentStatus: 'FULLY_PAID' as const,
      roomTypeIndex: 1,
      status: 'COMPLETED' as const,
    },
  ];

  for (const sample of samples) {
    const lodge = seededLodges[sample.lodgeIndex];
    const roomTypeId = lodge?.roomTypeIds[sample.roomTypeIndex];
    if (!lodge || !roomTypeId) {
      throw new Error(`Demo booking ${sample.bookingCode} references missing seeded inventory`);
    }
    const bookingData = {
      checkInDate: sample.checkInDate,
      checkOutDate: sample.checkOutDate,
      cityId: city.id,
      commissionAmount: Math.round(sample.amount * 0.1),
      guestEmail: 'anjali@example.com',
      guestName: 'Anjali Kulkarni',
      guestPhone: '+919876543210',
      lodgeId: lodge.id,
      numberOfAdults: 2,
      numberOfChildren: sample.lodgeIndex === 0 ? 1 : 0,
      paymentStatus: sample.paymentStatus,
      pilgrimUserId: pilgrim.id,
      roomTypeId,
      status: sample.status,
      totalAmount: sample.amount,
      totalGuests: sample.lodgeIndex === 0 ? 3 : 2,
    };
    await prisma.booking.upsert({
      create: { ...bookingData, bookingCode: sample.bookingCode },
      update: bookingData,
      where: { bookingCode: sample.bookingCode },
    });
  }
}

void main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
