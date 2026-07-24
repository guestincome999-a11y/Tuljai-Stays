export type BookingStatus = 'request' | 'confirmed' | 'checked-in' | 'completed';

export interface MockBooking {
  id: string;
  guest: string;
  phone: string;
  room: string;
  guests: number;
  checkIn: string;
  checkOut: string;
  amount: number;
  status: BookingStatus;
  payment: 'Paid' | 'Pay at lodge';
}

export const bookings: MockBooking[] = [
  {
    id: 'TS-2841',
    guest: 'Sneha Kulkarni',
    phone: '+91 98224 11840',
    room: 'Deluxe Family',
    guests: 4,
    checkIn: '14 Jul, 12:00 PM',
    checkOut: '16 Jul, 10:00 AM',
    amount: 4800,
    status: 'request',
    payment: 'Paid',
  },
  {
    id: 'TS-2838',
    guest: 'Ramesh Patil',
    phone: '+91 97655 42110',
    room: 'AC Double',
    guests: 2,
    checkIn: '14 Jul, 1:30 PM',
    checkOut: '15 Jul, 10:00 AM',
    amount: 2400,
    status: 'confirmed',
    payment: 'Paid',
  },
  {
    id: 'TS-2826',
    guest: 'Kavita Deshmukh',
    phone: '+91 94218 05210',
    room: 'Family Hall',
    guests: 6,
    checkIn: '14 Jul, 3:00 PM',
    checkOut: '17 Jul, 9:00 AM',
    amount: 6200,
    status: 'confirmed',
    payment: 'Pay at lodge',
  },
  {
    id: 'TS-2819',
    guest: 'Arun Joshi',
    phone: '+91 98817 62401',
    room: 'Non-AC Double',
    guests: 2,
    checkIn: '12 Jul, 11:00 AM',
    checkOut: '14 Jul, 10:00 AM',
    amount: 1800,
    status: 'checked-in',
    payment: 'Paid',
  },
  {
    id: 'TS-2804',
    guest: 'Meena Iyer',
    phone: '+91 98401 73216',
    room: 'AC Double',
    guests: 3,
    checkIn: '10 Jul, 2:00 PM',
    checkOut: '14 Jul, 11:00 AM',
    amount: 7200,
    status: 'checked-in',
    payment: 'Paid',
  },
  {
    id: 'TS-2792',
    guest: 'Suresh Rao',
    phone: '+91 99860 33772',
    room: 'Deluxe Family',
    guests: 4,
    checkIn: '16 Jul, 12:00 PM',
    checkOut: '18 Jul, 10:00 AM',
    amount: 5200,
    status: 'confirmed',
    payment: 'Paid',
  },
];

export const calendarDays = [
  { day: 'Mon', date: '13', count: 2 },
  { day: 'Tue', date: '14', count: 5, active: true },
  { day: 'Wed', date: '15', count: 3 },
  { day: 'Thu', date: '16', count: 6 },
  { day: 'Fri', date: '17', count: 4 },
  { day: 'Sat', date: '18', count: 8 },
];

export const roomTypes = [
  {
    id: 'deluxe',
    name: 'Deluxe Family',
    marathi: 'डिलक्स फॅमिली',
    rooms: 8,
    available: true,
    price: '2600',
  },
  {
    id: 'ac-double',
    name: 'AC Double',
    marathi: 'एसी डबल',
    rooms: 12,
    available: true,
    price: '2200',
  },
  {
    id: 'non-ac',
    name: 'Non-AC Double',
    marathi: 'नॉन-एसी डबल',
    rooms: 10,
    available: true,
    price: '1500',
  },
  {
    id: 'hall',
    name: 'Family Hall',
    marathi: 'फॅमिली हॉल',
    rooms: 3,
    available: false,
    price: '3200',
  },
];

export const payouts = [
  { id: 'PAY-0731', date: '8 Jul 2026', period: '1–7 Jul', amount: 38420, status: 'Paid' },
  { id: 'PAY-0718', date: '1 Jul 2026', period: '24–30 Jun', amount: 29750, status: 'Paid' },
  { id: 'PAY-0692', date: '24 Jun 2026', period: '17–23 Jun', amount: 32180, status: 'Paid' },
];

export const weeklyEarnings = [18500, 23600, 19800, 28400, 32100, 26600, 38420];
export const monthlyEarnings = [84200, 97800, 113400, 128600, 141200, 156800];
