import type { BulkLodgeImportRow, PropertyType } from '@tuljai/types';

export const LODGE_IMPORT_SHEET_NAME = 'Lodges';

export const lodgeImportHeaders = [
  'lodge_name',
  'slug',
  'property_type',
  'city_slug',
  'primary_phone',
  'secondary_phone',
  'whatsapp_number',
  'lodge_email',
  'description',
  'distance_from_temple_meters',
  'latitude',
  'longitude',
  'check_in_time',
  'check_out_time',
  'rules',
  'address_line_1',
  'address_line_2',
  'landmark',
  'address_city',
  'district',
  'state',
  'pincode',
  'country',
  'owner_phone',
  'owner_email',
  'owner_name',
  'owner_role_title',
  'amenity_slugs',
  'publish_live',
] as const;

const requiredHeaders = [
  'lodge_name',
  'slug',
  'property_type',
  'city_slug',
  'primary_phone',
  'address_line_1',
  'address_city',
  'district',
  'state',
  'pincode',
  'country',
  'owner_phone',
] as const;

const propertyTypes = new Set<PropertyType>([
  'LODGE',
  'BHAKT_NIWAS',
  'DHARAMSHALA',
  'HOTEL',
  'HOMESTAY',
]);

export interface LodgeImportParseResult {
  errors: string[];
  rows: BulkLodgeImportRow[];
}

export async function parseLodgeImportFile(file: File): Promise<LodgeImportParseResult> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { errors: ['Please choose an .xlsx Excel workbook.'], rows: [] };
  }
  if (file.size > 10 * 1024 * 1024) {
    return {
      errors: ['The workbook is larger than 10 MB. Remove unused sheets or images.'],
      rows: [],
    };
  }

  const { readSheet } = await import('read-excel-file/browser');
  let sheetData: unknown[][];
  try {
    sheetData = await readSheet(file, LODGE_IMPORT_SHEET_NAME);
  } catch {
    return {
      errors: [`The workbook must contain a worksheet named "${LODGE_IMPORT_SHEET_NAME}".`],
      rows: [],
    };
  }

  const headerColumns = readHeaderColumns(sheetData[0] ?? []);
  const missingHeaders = requiredHeaders.filter((header) => !headerColumns.has(header));
  if (missingHeaders.length) {
    return {
      errors: [`Missing required column(s): ${missingHeaders.join(', ')}.`],
      rows: [],
    };
  }

  const errors: string[] = [];
  const rows: BulkLodgeImportRow[] = [];

  for (let rowIndex = 1; rowIndex < sheetData.length; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const row = sheetData[rowIndex] ?? [];
    const value = (header: string) => readCellText(row[headerColumns.get(header)!]);
    const hasContent = lodgeImportHeaders.some((header) => {
      const column = headerColumns.get(header);
      return column === undefined ? false : readCellText(row[column]).length > 0;
    });
    if (!hasContent) continue;

    const propertyType = normalizePropertyType(value('property_type'));
    const publishLive = parseBoolean(value('publish_live'), rowNumber, errors);
    const distance = parseOptionalNumber(
      value('distance_from_temple_meters'),
      'distance_from_temple_meters',
      rowNumber,
      errors,
    );
    const latitude = parseOptionalNumber(value('latitude'), 'latitude', rowNumber, errors);
    const longitude = parseOptionalNumber(value('longitude'), 'longitude', rowNumber, errors);

    for (const header of requiredHeaders) {
      if (!value(header)) errors.push(`Row ${rowNumber}: ${header} is required.`);
    }
    if (!propertyTypes.has(propertyType)) {
      errors.push(
        `Row ${rowNumber}: property_type must be LODGE, BHAKT_NIWAS, DHARAMSHALA, HOTEL, or HOMESTAY.`,
      );
    }
    validatePhone(value('primary_phone'), 'primary_phone', rowNumber, errors);
    validatePhone(value('owner_phone'), 'owner_phone', rowNumber, errors);
    validateOptionalPhone(value('secondary_phone'), 'secondary_phone', rowNumber, errors);
    validateOptionalPhone(value('whatsapp_number'), 'whatsapp_number', rowNumber, errors);
    if (distance !== undefined && (!Number.isInteger(distance) || distance < 0)) {
      errors.push(
        `Row ${rowNumber}: distance_from_temple_meters must be a whole number of 0 or more.`,
      );
    }
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      errors.push(`Row ${rowNumber}: latitude must be between -90 and 90.`);
    }
    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      errors.push(`Row ${rowNumber}: longitude must be between -180 and 180.`);
    }

    rows.push({
      address: {
        addressLine1: value('address_line_1'),
        addressLine2: optional(value('address_line_2')),
        city: value('address_city'),
        country: value('country'),
        district: value('district'),
        landmark: optional(value('landmark')),
        pincode: value('pincode'),
        state: value('state'),
      },
      amenitySlugs: splitList(value('amenity_slugs')),
      checkInTime: optional(readTimeCell(row[headerColumns.get('check_in_time')!])),
      checkOutTime: optional(readTimeCell(row[headerColumns.get('check_out_time')!])),
      citySlug: value('city_slug').toLowerCase(),
      description: optional(value('description')),
      distanceFromTempleMeters: distance,
      email: optional(value('lodge_email').toLowerCase()),
      latitude,
      longitude,
      name: value('lodge_name'),
      ownerEmail: optional(value('owner_email').toLowerCase()),
      ownerName: optional(value('owner_name')),
      ownerPhone: value('owner_phone'),
      ownerRoleTitle: optional(value('owner_role_title')),
      primaryPhone: value('primary_phone'),
      propertyType,
      publishLive,
      rowNumber,
      rules: optional(value('rules')),
      secondaryPhone: optional(value('secondary_phone')),
      slug: value('slug').toLowerCase(),
      whatsappNumber: optional(value('whatsapp_number')),
    });
  }

  if (!rows.length && !errors.length) {
    errors.push('No lodge rows were found. Add data below the header row and upload again.');
  }

  return { errors, rows };
}

function readHeaderColumns(headerRow: unknown[]): Map<string, number> {
  const columns = new Map<string, number>();
  headerRow.forEach((cell, columnNumber) => {
    const header = readCellText(cell)
      .toLowerCase()
      .replace(/[\s-]+/gu, '_');
    if (header) columns.set(header, columnNumber);
  });
  return columns;
}

function readCellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function readTimeCell(value: unknown): string {
  if (value instanceof Date) {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return readCellText(value);
}

function normalizePropertyType(value: string): PropertyType {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/gu, '_') as PropertyType;
}

function optional(value: string): string | undefined {
  return value || undefined;
}

function splitList(value: string): string[] | undefined {
  const items = [
    ...new Set(
      value
        .split(/[,;\n]/u)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  return items.length ? items : undefined;
}

function parseOptionalNumber(
  value: string,
  field: string,
  rowNumber: number,
  errors: string[],
): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/,/gu, ''));
  if (!Number.isFinite(parsed)) {
    errors.push(`Row ${rowNumber}: ${field} must be a number.`);
    return undefined;
  }
  return parsed;
}

function parseBoolean(value: string, rowNumber: number, errors: string[]): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  if (['yes', 'true', '1'].includes(normalized)) return true;
  if (['no', 'false', '0'].includes(normalized)) return false;
  errors.push(`Row ${rowNumber}: publish_live must be YES or NO.`);
  return false;
}

function validatePhone(value: string, field: string, rowNumber: number, errors: string[]): void {
  if (value && !/^\+[1-9]\d{7,14}$/u.test(value)) {
    errors.push(
      `Row ${rowNumber}: ${field} must include the country code, for example +919876543210.`,
    );
  }
}

function validateOptionalPhone(
  value: string,
  field: string,
  rowNumber: number,
  errors: string[],
): void {
  if (value) validatePhone(value, field, rowNumber, errors);
}
