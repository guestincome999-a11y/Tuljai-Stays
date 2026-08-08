import type { Booking, GuestIdType, GuestRegister } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import { getOwnerBooking } from '../../bookings/api/owner-bookings-api';
import {
  checkoutRegister,
  getGuestRegister,
  markRegisterIdVerified,
  updateRegisterNotes,
} from '../api/checkin-api';

interface GuestRegisterState {
  booking: Booking | null;
  data: GuestRegister | null;
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useGuestRegister(registerId: string | null) {
  const [state, setState] = useState<GuestRegisterState>({
    booking: null,
    data: null,
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (!registerId) {
        setState({
          booking: null,
          data: null,
          errorMessage: 'This guest register could not be opened.',
          isLoading: false,
          isRefreshing: false,
        });
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && !current.data,
        isRefreshing: refreshing,
      }));

      try {
        const register = await getGuestRegister(registerId);
        const booking = await getOwnerBooking(register.bookingId).catch(() => null);
        const data = hydrateRegisterGuests(register, booking);
        setState({ booking, data, errorMessage: null, isLoading: false, isRefreshing: false });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Guest register could not be loaded.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [registerId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const markIdVerified = useCallback(
    async (input: {
      documentHolderName?: string;
      governmentIdNumber?: string;
      governmentIdType?: GuestIdType;
    }) => {
      if (!registerId) {
        return;
      }

      setIsSubmitting(true);
      setSuccessMessage(null);

      try {
        const data = await markRegisterIdVerified(registerId, input);
        setState((current) => ({
          ...current,
          data: hydrateRegisterGuests(data, current.booking),
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
        }));
        setSuccessMessage('Guest ID marked as verified.');
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'ID verification could not be saved.',
        }));
      } finally {
        setIsSubmitting(false);
      }
    },
    [registerId],
  );

  const saveNotes = useCallback(
    async (ownerNotes: string) => {
      if (!registerId) {
        return;
      }

      setIsSubmitting(true);
      setSuccessMessage(null);

      try {
        const data = await updateRegisterNotes(registerId, ownerNotes);
        setState((current) => ({
          ...current,
          data: hydrateRegisterGuests(data, current.booking),
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
        }));
        setSuccessMessage('Owner notes saved.');
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Owner notes could not be saved.',
        }));
      } finally {
        setIsSubmitting(false);
      }
    },
    [registerId],
  );

  const checkout = useCallback(async () => {
    if (!registerId) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const result = await checkoutRegister(registerId);
      setState({
        booking: result.booking,
        data: hydrateRegisterGuests(result.register, result.booking),
        errorMessage: null,
        isLoading: false,
        isRefreshing: false,
      });
      setSuccessMessage('Checkout Completed Successfully.');
    } catch {
      setState((current) => ({
        ...current,
        errorMessage: 'Checkout could not be completed.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  }, [registerId]);

  return {
    ...state,
    checkout,
    isSubmitting,
    markIdVerified,
    refresh: () => load(true),
    saveNotes,
    setSuccessMessage,
    successMessage,
  };
}

function hydrateRegisterGuests(register: GuestRegister, booking: Booking | null): GuestRegister {
  if (register.guests.length > 0 || !booking || !Array.isArray(booking.guests)) {
    return register;
  }

  return {
    ...register,
    guests: booking.guests.map((guest) => ({
      age: guest.age,
      fullName: guest.fullName,
      gender: guest.gender,
      id: guest.id,
      idNumber: guest.idNumber,
      idProofAvailable: Boolean(guest.idProofStoragePath),
      idProofMimeType: guest.idProofMimeType,
      idProofOriginalName: guest.idProofOriginalName,
      idType: guest.idType,
      isPrimaryGuest: guest.isPrimaryGuest,
      phone: guest.phone,
    })),
  };
}
