import type { Amenity } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import {
  getOwnerLodgeDetails,
  listAvailableAmenities,
  updateOwnerLodgeAmenities,
} from '../api/owner-amenities-api';

interface AmenitiesState {
  allAmenities: Amenity[];
  errorMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  selectedAmenityIds: string[];
}

export function useOwnerAmenities() {
  const assignedLodges = useAssignedLodges();
  const { isOffline } = useConnectivity();
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const [state, setState] = useState<AmenitiesState>({
    allAmenities: [],
    errorMessage: null,
    isLoading: true,
    isRefreshing: false,
    selectedAmenityIds: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (!lodgeId) {
        setState({
          allAmenities: [],
          errorMessage: 'No lodge selected.',
          isLoading: false,
          isRefreshing: false,
          selectedAmenityIds: [],
        });
        return;
      }

      if (isOffline) {
        setState((current) => ({
          ...current,
          errorMessage: 'Connect to the internet to manage lodge amenities.',
          isLoading: false,
          isRefreshing: false,
        }));
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && current.allAmenities.length === 0,
        isRefreshing: refreshing,
      }));

      try {
        const [allAmenities, lodge] = await Promise.all([
          listAvailableAmenities(),
          getOwnerLodgeDetails(lodgeId),
        ]);
        setState({
          allAmenities,
          errorMessage: null,
          isLoading: false,
          isRefreshing: false,
          selectedAmenityIds: lodge.amenities.map((amenity) => amenity.id),
        });
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Lodge amenities could not be loaded.',
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [isOffline, lodgeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedAmenities = useMemo(
    () =>
      state.allAmenities.filter((amenity) => state.selectedAmenityIds.includes(amenity.id)),
    [state.allAmenities, state.selectedAmenityIds],
  );

  return {
    ...state,
    isOffline,
    isSaving,
    refresh: () => load(true),
    selectedAmenities,
    setSuccessMessage,
    successMessage,
    toggleAmenity: (amenityId: string) => {
      setState((current) => ({
        ...current,
        selectedAmenityIds: current.selectedAmenityIds.includes(amenityId)
          ? current.selectedAmenityIds.filter((id) => id !== amenityId)
          : [...current.selectedAmenityIds, amenityId],
      }));
      setSuccessMessage(null);
    },
    save: async () => {
      if (!lodgeId || isOffline) {
        setState((current) => ({
          ...current,
          errorMessage: 'Connect to the internet to save amenities.',
        }));
        return false;
      }

      setIsSaving(true);
      setSuccessMessage(null);
      try {
        await updateOwnerLodgeAmenities(lodgeId, state.selectedAmenityIds);
        setSuccessMessage('Lodge amenities updated.');
        return true;
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Amenities could not be saved. Please try again.',
        }));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
  };
}
