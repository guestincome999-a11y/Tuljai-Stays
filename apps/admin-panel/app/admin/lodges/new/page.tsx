'use client';

import type { City, PropertyType } from '@tuljai/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import {
  createGovernanceLodge,
  listLodgeCities,
  type CreateLodgeInput,
} from '../../../../src/api/admin-governance-api';
import { PermissionGate } from '../../../../src/components/PermissionGate';

const propertyTypes: Array<{ label: string; value: PropertyType }> = [
  { label: 'Lodge', value: 'LODGE' },
  { label: 'Bhakt Niwas', value: 'BHAKT_NIWAS' },
  { label: 'Dharamshala', value: 'DHARAMSHALA' },
  { label: 'Hotel', value: 'HOTEL' },
  { label: 'Homestay', value: 'HOMESTAY' },
];

export default function NewLodgePage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [cityError, setCityError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void listLodgeCities()
      .then(setCities)
      .catch(() => setCityError('Cities could not be loaded. Check that the backend is running.'))
      .finally(() => setIsLoadingCities(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const optionalText = (name: string) => text(name) || undefined;
    const optionalNumber = (name: string) => {
      const value = text(name);
      return value ? Number(value) : undefined;
    };
    const input: CreateLodgeInput = {
      address: {
        addressLine1: text('addressLine1'),
        addressLine2: optionalText('addressLine2'),
        city: text('addressCity'),
        country: text('country'),
        district: text('district'),
        landmark: optionalText('landmark'),
        pincode: text('pincode'),
        state: text('state'),
      },
      checkInTime: optionalText('checkInTime'),
      checkOutTime: optionalText('checkOutTime'),
      cityId: text('cityId'),
      description: optionalText('description'),
      distanceFromTempleMeters: optionalNumber('distanceFromTempleMeters'),
      email: optionalText('email'),
      latitude: optionalNumber('latitude'),
      longitude: optionalNumber('longitude'),
      name: text('name'),
      primaryPhone: text('primaryPhone'),
      propertyType: text('propertyType') as PropertyType,
      rules: optionalText('rules'),
      secondaryPhone: optionalText('secondaryPhone'),
      slug: text('slug'),
      whatsappNumber: optionalText('whatsappNumber'),
    };

    try {
      const lodge = await createGovernanceLodge(input);
      router.push(`/admin/lodges/${lodge.id}?created=1`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The lodge could not be created.');
      setIsSubmitting(false);
    }
  }

  return (
    <PermissionGate permission="lodges.manage">
      <div className="page-stack">
        <section className="hero-panel command-hero">
          <div>
            <p className="eyebrow">Lodge Management</p>
            <h2>Add Lodge</h2>
            <p className="muted-copy">
              Create the property record. Rooms, photos, and verification can be added next.
            </p>
          </div>
          <Link className="button button-secondary" href="/admin/lodges">
            Back to Lodges
          </Link>
        </section>

        {cityError ? <section className="error-banner">{cityError}</section> : null}
        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <form className="panel form-stack" onSubmit={(event) => void submit(event)}>
          <h3>Property details</h3>
          <div className="control-grid">
            <Field label="Lodge name" name="name" required />
            <Field
              label="Unique URL slug"
              name="slug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="tuljai-guest-house-2"
              required
              title="Use lowercase letters, numbers, and hyphens. The slug must be unique within the selected city."
            />
            <label>
              <span>Property type</span>
              <select name="propertyType" required>
                {propertyTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Service city</span>
              <select disabled={isLoadingCities} name="cityId" required defaultValue="">
                <option disabled value="">
                  {isLoadingCities ? 'Loading cities…' : 'Select a city'}
                </option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}, {city.state}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Primary phone"
              name="primaryPhone"
              placeholder="+919876543210"
              pattern="\+[1-9][0-9]{7,14}"
              required
            />
            <Field
              label="Secondary phone"
              name="secondaryPhone"
              placeholder="+919876543210"
              pattern="\+[1-9][0-9]{7,14}"
            />
            <Field
              label="WhatsApp number"
              name="whatsappNumber"
              placeholder="+919876543210"
              pattern="\+[1-9][0-9]{7,14}"
            />
            <Field label="Email" name="email" type="email" />
            <Field
              label="Distance from temple (metres)"
              name="distanceFromTempleMeters"
              type="number"
              min="0"
            />
            <Field label="Latitude" name="latitude" type="number" min="-90" max="90" step="any" />
            <Field
              label="Longitude"
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
            />
            <Field label="Check-in time" name="checkInTime" type="time" />
            <Field label="Check-out time" name="checkOutTime" type="time" />
          </div>
          <label className="form-field">
            <span>Description</span>
            <textarea name="description" rows={4} />
          </label>

          <h3>Address</h3>
          <div className="control-grid">
            <Field label="Address line 1" name="addressLine1" required />
            <Field label="Address line 2" name="addressLine2" />
            <Field label="Landmark" name="landmark" />
            <Field label="City / town" name="addressCity" required />
            <Field label="District" name="district" required />
            <Field label="State" name="state" defaultValue="Maharashtra" required />
            <Field label="Pincode" name="pincode" required />
            <Field label="Country" name="country" defaultValue="India" required />
          </div>
          <label className="form-field">
            <span>Property rules</span>
            <textarea name="rules" rows={4} />
          </label>

          <div className="row-actions">
            <button
              className="button button-primary"
              disabled={isSubmitting || isLoadingCities || cities.length === 0}
              type="submit"
            >
              {isSubmitting ? 'Creating…' : 'Create Lodge'}
            </button>
            <Link className="button button-secondary" href="/admin/lodges">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </PermissionGate>
  );
}

function Field({
  label,
  ...inputProps
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      <span>{label}</span>
      <input {...inputProps} />
    </label>
  );
}
