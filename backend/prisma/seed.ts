import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type { AmenityCategory } from '../generated/prisma';
import { PrismaClient } from '../generated/prisma';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/tuljai_stays?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const defaultAmenities: Array<{ category: AmenityCategory; name: string; slug: string }> = [
  { category: 'ROOM', name: 'AC', slug: 'ac' },
  { category: 'ROOM', name: 'Non-AC', slug: 'non-ac' },
  { category: 'ROOM', name: 'Hot Water', slug: 'hot-water' },
  { category: 'PARKING', name: 'Parking', slug: 'parking' },
  { category: 'FAMILY', name: 'Family Friendly', slug: 'family-friendly' },
  { category: 'SAFETY', name: 'CCTV', slug: 'cctv' },
  { category: 'ACCESSIBILITY', name: 'Lift', slug: 'lift' },
  { category: 'PROPERTY', name: 'WiFi', slug: 'wifi' },
  { category: 'FOOD', name: 'Restaurant', slug: 'restaurant' },
  { category: 'PROPERTY', name: 'Generator Backup', slug: 'generator-backup' },
];

async function main(): Promise<void> {
  await prisma.city.upsert({
    create: {
      country: 'India',
      name: 'Tuljapur',
      slug: 'tuljapur',
      state: 'Maharashtra',
    },
    update: {
      country: 'India',
      isActive: true,
      name: 'Tuljapur',
      state: 'Maharashtra',
    },
    where: { slug: 'tuljapur' },
  });

  for (const amenity of defaultAmenities) {
    await prisma.amenity.upsert({
      create: amenity,
      update: {
        category: amenity.category,
        isActive: true,
        name: amenity.name,
      },
      where: { slug: amenity.slug },
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
