import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import type {
  AdminBookingSummary,
  AuthenticatedUser,
  Booking,
  OwnerBookingSummary,
  PaginatedResponse,
} from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';

import { BookingAvailabilityService } from './booking-availability.service';
import { BookingHistoryService } from './booking-history.service';
import type {
  AdminBookingsQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  OwnerBookingsQueryDto,
  RejectBookingDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto';
import { GuestIdProofService } from './guest-id-proof.service';

const OWNER_VISIBLE_CONTACT_STATUSES: BookingStatus[] = ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'];

const ADMIN_ALLOWED_STATUS_UPDATES: BookingStatus[] = [