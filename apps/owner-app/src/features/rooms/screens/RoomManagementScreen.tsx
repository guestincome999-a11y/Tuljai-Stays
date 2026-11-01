import type {
  LodgePhoto,
  ManualBookingBlock,
  PhotoCategory,
  Room,
  RoomStatus,
  RoomType,
} from '@tuljai/types';
import { EmptyState } from '@tuljai/ui';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  IconButton,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { StatusBadge } from '../../../owner-ui/components';
import { ownerColors } from '../../../owner-ui/theme';
import { radius, spacing } from '../../../owner-ui/theme';
import { DateRangeModal } from '../../bookings/components/DateRangeModal';
import { addDays, formatDateKey, toDateKey } from '../../bookings/utils/booking-display';
import { useOwnerAmenities } from '../../lodge-management/hooks/useOwnerAmenities';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import type { PickedPhoto } from '../api/owner-rooms-api';
import { useDateAvailability } from '../hooks/useDateAvailability';
import { useRoomOperations } from '../hooks/useRoomOperations';

type RoomTab = 'AMENITIES' | 'ROOM_TYPES' | 'ROOMS' | 'AVAILABILITY' | 'GALLERY';

const tabs: Array<{ label: string; value: RoomTab }> = [
  { label: 'Availability', value: 'AVAILABILITY' },
  { label: 'Rooms', value: 'ROOMS' },
  { label: 'Room Types', value: 'ROOM_TYPES' },
  { label: 'Amenities', value: 'AMENITIES' },
  { label: 'Gallery', value: 'GALLERY' },
];

const quickStatuses: Array<{ label: string; status: RoomStatus }> = [
  { label: 'Mark Available', status: 'AVAILABLE' },
  { label: 'Mark Cleaning', status: 'CLEANING' },
  { label: 'Mark Maintenance', status: 'MAINTENANCE' },
  { label: 'Block Room', status: 'BLOCKED' },
];

const photoCategories: PhotoCategory[] = [
  'COVER',
  'EXTERIOR',
  'RECEPTION',
  'ROOM',
  'BATHROOM',
  'PARKING',
  'AMENITY',
  'OTHER',
];

export function RoomManagementScreen() {
  const params = useLocalSearchParams<{
    roomId?: string;
    roomTypeId?: string;
    tab?: string;
    action?: string;
  }>();
  const router = useRouter();
  const assignedLodges = useAssignedLodges();
  const amenities = useOwnerAmenities();
  const rooms = useRoomOperations();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<RoomTab>('AVAILABILITY');
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomTypeFormVisible, setRoomTypeFormVisible] = useState(false);
  const [roomFormVisible, setRoomFormVisible] = useState(false);
  const [manualBookingFormVisible, setManualBookingFormVisible] = useState(false);
  const [photoFormVisible, setPhotoFormVisible] = useState(false);
  const [stay, setStay] = useState(() => ({
    from: toDateKey(new Date()),
    to: toDateKey(addDays(new Date(), 1)),
  }));
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const availability = useDateAvailability(
    assignedLodges.selectedLodge?.id ?? null,
    rooms.roomTypes,
    stay.from,
    stay.to,
    activeTab === 'AVAILABILITY',
    rooms.isOffline,
  );
  const selectedLodgeName =
    assignedLodges.selectedLodge?.name ??
    (assignedLodges.isLoading ? 'Loading lodge…' : 'No lodge selected');
  const statusCounts = getRoomStatusCounts(rooms.rooms);
  const focusedRoomId = typeof params.roomId === 'string' ? params.roomId : null;
  const focusedRoomTypeId = typeof params.roomTypeId === 'string' ? params.roomTypeId : null;
  const displayedRooms = useMemo(
    () =>
      focusedRoomId || focusedRoomTypeId
        ? [...rooms.rooms].sort((left, right) => {
            const leftFocused = left.id === focusedRoomId || left.roomTypeId === focusedRoomTypeId;
            const rightFocused =
              right.id === focusedRoomId || right.roomTypeId === focusedRoomTypeId;
            return Number(rightFocused) - Number(leftFocused);
          })
        : rooms.rooms,
    [focusedRoomId, focusedRoomTypeId, rooms.rooms],
  );

  useEffect(() => {
    if (focusedRoomId || focusedRoomTypeId) {
      setActiveTab('ROOMS');
    }
  }, [focusedRoomId, focusedRoomTypeId]);

  useEffect(() => {
    if (params.tab && tabs.some((tab) => tab.value === params.tab)) {
      setActiveTab(params.tab as RoomTab);
    }
    if (params.action === 'manual') {
      setManualBookingFormVisible(true);
      router.setParams({ action: undefined });
    }
  }, [params.action, params.tab, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.screen}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void rooms.refresh();
              void amenities.refresh();
            }}
            refreshing={rooms.isRefreshing || amenities.isRefreshing}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text variant="headlineSmall">Room Availability</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            {selectedLodgeName}
          </Text>
        </View>

        <View style={styles.dateRow}>
          {[
            { label: 'Check-in', value: stay.from },
            { label: 'Check-out', value: stay.to },
          ].map((date) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose ${date.label} date, ${formatDateKey(date.value)}`}
              key={date.label}
              onPress={() => setDatePickerVisible(true)}
              style={styles.dateCard}
            >
              <Text style={{ color: ownerColors.muted }} variant="labelSmall">
                {date.label}
              </Text>
              <Text variant="titleSmall">{formatDateKey(date.value)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.summaryGrid}>
          <SummaryCard
            label="All Rooms"
            value={
              rooms.isLoading || assignedLodges.isLoading ? '—' : rooms.rooms.length.toString()
            }
          />
          <SummaryCard
            label="Available now"
            value={
              rooms.isLoading || assignedLodges.isLoading
                ? '—'
                : (statusCounts.AVAILABLE ?? 0).toString()
            }
          />
          <SummaryCard
            label="Occupied now"
            value={
              rooms.isLoading || assignedLodges.isLoading
                ? '—'
                : (statusCounts.OCCUPIED ?? 0).toString()
            }
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <Button
                key={tab.value}
                mode={activeTab === tab.value ? 'contained' : 'outlined'}
                onPress={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </View>
        </ScrollView>

        <FormErrorBanner
          message={
            assignedLodges.isLoading
              ? null
              : (rooms.errorMessage ??
                amenities.errorMessage ??
                (rooms.isOffline ? 'Connect to the internet to update rooms.' : null))
          }
        />

        {rooms.isLoading || assignedLodges.isLoading || amenities.isLoading ? (
          <ActivityIndicator animating size="large" />
        ) : null}

        {activeTab === 'AMENITIES' ? (
          <AmenitiesTab
            amenities={amenities.allAmenities}
            isSaving={amenities.isSaving}
            selectedAmenityIds={amenities.selectedAmenityIds}
            onSave={() => {
              void amenities.save();
            }}
            onToggle={amenities.toggleAmenity}
          />
        ) : null}

        {activeTab === 'ROOM_TYPES' ? (
          <RoomTypesTab
            isSubmitting={rooms.isSubmitting}
            roomTypes={rooms.roomTypes}
            onAdd={() => {
              setEditingRoomType(null);
              setRoomTypeFormVisible(true);
            }}
            onEdit={(type) => {
              setEditingRoomType(type);
              setRoomTypeFormVisible(true);
            }}
            onToggle={(roomType) => {
              void rooms.updateRoomType(roomType.id, { isActive: !roomType.isActive });
            }}
          />
        ) : null}

        {activeTab === 'ROOMS' ? (
          <RoomsTab
            housekeepingNotes={rooms.housekeepingNotes}
            isSubmitting={rooms.isSubmitting}
            focusedRoomId={focusedRoomId}
            focusedRoomTypeId={focusedRoomTypeId}
            roomTypeById={rooms.roomTypeById}
            rooms={displayedRooms}
            onAdd={() => {
              setEditingRoom(null);
              setRoomFormVisible(true);
            }}
            onEdit={(room) => {
              setEditingRoom(room);
              setRoomFormVisible(true);
            }}
            onSaveNote={(roomId, note) => {
              void rooms.saveHousekeepingNote(roomId, note);
            }}
            onStatusChange={(room, status) => {
              if (room.status === 'OCCUPIED' && status !== 'OCCUPIED') {
                Alert.alert(
                  'Room is occupied',
                  'Changing an occupied room can affect active guests. Continue?',
                  [
                    { style: 'cancel', text: 'Cancel' },
                    {
                      onPress: () => {
                        void rooms.updateRoomStatus(room.id, status);
                      },
                      text: 'Continue',
                    },
                  ],
                );
                return;
              }

              void rooms.updateRoomStatus(room.id, status);
            }}
          />
        ) : null}

        {activeTab === 'AVAILABILITY' ? (
          <AvailabilityTab
            availability={availability}
            roomTypes={rooms.roomTypes}
            isSubmitting={rooms.isSubmitting}
            manualBookings={rooms.manualBookings}
            rooms={rooms.rooms}
            onAdd={() => setManualBookingFormVisible(true)}
            onRemove={(booking) => {
              Alert.alert(
                'Remove offline booking?',
                `Room ${booking.roomNumber} will become available again for ${booking.checkInDate} to ${booking.checkOutDate}.`,
                [
                  { style: 'cancel', text: 'Keep booking' },
                  {
                    onPress: () => {
                      void rooms.deleteManualBooking(booking.id);
                    },
                    style: 'destructive',
                    text: 'Remove booking',
                  },
                ],
              );
            }}
          />
        ) : null}

        {activeTab === 'GALLERY' ? (
          <GalleryTab photos={rooms.photos} onAdd={() => setPhotoFormVisible(true)} />
        ) : null}
      </ScrollView>

      <DateRangeModal
        initialFrom={stay.from}
        initialTo={stay.to}
        requireRange
        title="Choose stay dates"
        hint="Choose check-in and a later check-out to check live availability."
        visible={datePickerVisible}
        onCancel={() => setDatePickerVisible(false)}
        onApply={(from, to) => {
          setStay({ from, to });
          setDatePickerVisible(false);
        }}
      />
      <RoomTypeModal
        errorMessage={rooms.errorMessage}
        initial={editingRoomType}
        isSubmitting={rooms.isSubmitting}
        visible={roomTypeFormVisible}
        onClose={() => setRoomTypeFormVisible(false)}
        onSubmit={(input) => {
          const operation = editingRoomType
            ? rooms.updateRoomType(editingRoomType.id, { ...input, slug: editingRoomType.slug })
            : rooms.createRoomType(input);
          void operation.then((saved) => {
            if (saved) {
              setRoomTypeFormVisible(false);
            }
          });
        }}
      />
      <RoomModal
        errorMessage={rooms.errorMessage}
        initial={editingRoom}
        isSubmitting={rooms.isSubmitting}
        roomTypes={rooms.roomTypes}
        visible={roomFormVisible}
        onClose={() => setRoomFormVisible(false)}
        onSubmit={(roomTypeId, input) => {
          const operation = editingRoom
            ? rooms.updateRoom(editingRoom.id, input)
            : rooms.createRoom(roomTypeId, input);
          void operation.then((saved) => {
            if (saved) {
              setRoomFormVisible(false);
            }
          });
        }}
      />
      <ManualBookingModal
        errorMessage={rooms.errorMessage}
        isSubmitting={rooms.isSubmitting}
        rooms={rooms.rooms}
        visible={manualBookingFormVisible}
        onClose={() => setManualBookingFormVisible(false)}
        onSubmit={(roomId, input) => {
          void rooms.createManualBooking(roomId, input).then((saved) => {
            if (saved) {
              setManualBookingFormVisible(false);
            }
          });
        }}
      />
      <PhotoMetadataModal
        errorMessage={rooms.errorMessage}
        isSubmitting={rooms.isSubmitting}
        visible={photoFormVisible}
        onClose={() => setPhotoFormVisible(false)}
        onSubmit={(inputs) => {
          void (async () => {
            let allSaved = true;
            for (const input of inputs) {
              const saved = await rooms.createPhotoMetadata(input);
              if (!saved) {
                allSaved = false;
              }
            }
            if (allSaved) {
              setPhotoFormVisible(false);
            }
          })();
        }}
        onUploadPhoto={rooms.uploadPhoto}
      />
      <Snackbar
        onDismiss={() => rooms.setSuccessMessage(null)}
        visible={Boolean(rooms.successMessage)}
      >
        {rooms.successMessage}
      </Snackbar>
      <Snackbar
        onDismiss={() => amenities.setSuccessMessage(null)}
        visible={Boolean(amenities.successMessage)}
      >
        {amenities.successMessage}
      </Snackbar>
    </View>
  );
}

function AmenitiesTab({
  amenities,
  isSaving,
  onSave,
  onToggle,
  selectedAmenityIds,
}: {
  amenities: Array<{ category: string; id: string; name: string }>;
  isSaving: boolean;
  onSave: () => void;
  onToggle: (amenityId: string) => void;
  selectedAmenityIds: string[];
}) {
  return (
    <View style={styles.section}>
      <Text variant="titleMedium">Amenities shown to pilgrims</Text>
      <Text variant="bodyMedium">
        Select every facility currently available at your lodge, then save the changes.
      </Text>
      <View style={styles.chips}>
        {amenities.map((amenity) => (
          <Chip
            icon={selectedAmenityIds.includes(amenity.id) ? 'check-circle' : 'circle-outline'}
            key={amenity.id}
            selected={selectedAmenityIds.includes(amenity.id)}
            onPress={() => onToggle(amenity.id)}
          >
            {amenity.name}
          </Chip>
        ))}
      </View>
      {amenities.length === 0 ? (
        <EmptyState
          title="No amenities configured"
          description="Ask an administrator to create the amenity catalogue first."
        />
      ) : null}
      <Button
        disabled={isSaving}
        icon="content-save-outline"
        loading={isSaving}
        mode="contained"
        onPress={onSave}
      >
        Save Amenities
      </Button>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <Card mode="outlined" style={styles.summaryCard}>
      <Card.Content style={styles.summaryContent}>
        <Text style={{ color: theme.colors.primary }} variant="headlineSmall">
          {value}
        </Text>
        <Text variant="bodySmall">{label}</Text>
      </Card.Content>
    </Card>
  );
}

function RoomTypesTab({
  isSubmitting,
  onAdd,
  onEdit,
  onToggle,
  roomTypes,
}: {
  isSubmitting: boolean;
  onAdd: () => void;
  onEdit: (type: RoomType) => void;
  onToggle: (roomType: RoomType) => void;
  roomTypes: RoomType[];
}) {
  return (
    <View style={styles.section}>
      <Button icon="plus" mode="contained" onPress={onAdd}>
        Add Room Type
      </Button>
      {roomTypes.length === 0 ? (
        <EmptyState
          title="No room types"
          description="Add room types before creating physical rooms."
        />
      ) : null}
      {roomTypes.map((roomType) => (
        <Card key={roomType.id} mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.titleBlock}>
                <Text variant="titleMedium">{roomType.name}</Text>
                <Text variant="bodySmall">{roomType.description || 'No description'}</Text>
              </View>
              <Chip>{roomType.isActive ? 'Active' : 'Inactive'}</Chip>
            </View>
            <Text variant="bodyMedium">
              Capacity: {roomType.capacityAdults} adults, {roomType.capacityChildren} children
            </Text>
            <Text variant="bodyMedium">Base price: Rs. {formatMoney(roomType.basePrice)}</Text>
            <Text variant="bodyMedium">
              Festival price:{' '}
              {roomType.festivalPrice ? `Rs. ${formatMoney(roomType.festivalPrice)}` : 'Not set'}
            </Text>
            <Text variant="bodyMedium">Total rooms: {roomType.totalRooms}</Text>
            <Button
              icon="pencil-outline"
              disabled={isSubmitting}
              mode="outlined"
              onPress={() => onEdit(roomType)}
            >
              Edit category & pricing
            </Button>
            <Button
              disabled={isSubmitting}
              mode="contained-tonal"
              onPress={() => onToggle(roomType)}
            >
              {roomType.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </Card.Content>
        </Card>
      ))}
    </View>
  );
}

function RoomsTab({
  focusedRoomId,
  focusedRoomTypeId,
  housekeepingNotes,
  isSubmitting,
  onAdd,
  onEdit,
  onSaveNote,
  onStatusChange,
  roomTypeById,
  rooms,
}: {
  focusedRoomId: string | null;
  focusedRoomTypeId: string | null;
  housekeepingNotes: Record<string, string>;
  isSubmitting: boolean;
  onAdd: () => void;
  onEdit: (room: Room) => void;
  onSaveNote: (roomId: string, note: string) => void;
  onStatusChange: (room: Room, status: RoomStatus) => void;
  roomTypeById: Map<string, RoomType>;
  rooms: Room[];
}) {
  return (
    <View style={styles.section}>
      <Button icon="plus" mode="contained" onPress={onAdd}>
        Add Room
      </Button>
      {rooms.map((room) => (
        <RoomCard
          housekeepingNote={housekeepingNotes[room.id] ?? ''}
          focused={room.id === focusedRoomId || room.roomTypeId === focusedRoomTypeId}
          isSubmitting={isSubmitting}
          key={room.id}
          room={room}
          roomType={roomTypeById.get(room.roomTypeId)}
          onEdit={onEdit}
          onSaveNote={onSaveNote}
          onStatusChange={onStatusChange}
        />
      ))}
    </View>
  );
}

function RoomCard({
  focused,
  onEdit,
  housekeepingNote,
  isSubmitting,
  onSaveNote,
  onStatusChange,
  room,
  roomType,
}: {
  focused: boolean;
  onEdit: (room: Room) => void;
  housekeepingNote: string;
  isSubmitting: boolean;
  onSaveNote: (roomId: string, note: string) => void;
  onStatusChange: (room: Room, status: RoomStatus) => void;
  room: Room;
  roomType?: RoomType;
}) {
  const [note, setNote] = useState(housekeepingNote);

  return (
    <Card mode="outlined" style={[styles.card, focused ? styles.focusedCard : undefined]}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text variant="titleMedium">Room {room.roomNumber}</Text>
            <Text variant="bodySmall">
              {roomType?.name ?? 'Room type'} - Floor {room.floor || 'Not set'}
            </Text>
          </View>
          <StatusBadge
            label={formatStatus(room.status)}
            tone={
              room.status === 'AVAILABLE'
                ? 'success'
                : room.status === 'OCCUPIED'
                  ? 'danger'
                  : 'warning'
            }
          />
        </View>
        <Button
          icon="pencil-outline"
          disabled={isSubmitting}
          mode="outlined"
          onPress={() => onEdit(room)}
        >
          Edit room details
        </Button>
        <View style={styles.quickActions}>
          {quickStatuses.map((item) => (
            <Button
              accessibilityLabel={`${item.label} ${room.roomNumber}`}
              disabled={isSubmitting}
              key={item.status}
              mode={room.status === item.status ? 'contained' : 'outlined'}
              onPress={() => onStatusChange(room, item.status)}
            >
              {item.label}
            </Button>
          ))}
        </View>
        <TextInput
          accessibilityLabel="Housekeeping note"
          outlineStyle={{ borderRadius: radius.md }}
          label="Housekeeping note"
          mode="outlined"
          placeholder="Needs cleaning, linen changed, ready for guest"
          value={note}
          onChangeText={setNote}
        />
        <Button mode="contained-tonal" onPress={() => onSaveNote(room.id, note)}>
          Save Note Locally
        </Button>
      </Card.Content>
    </Card>
  );
}

function AvailabilityTab({
  availability,
  roomTypes,
  isSubmitting,
  manualBookings,
  onAdd,
  onRemove,
  rooms,
}: {
  availability: ReturnType<typeof useDateAvailability>;
  roomTypes: RoomType[];
  isSubmitting: boolean;
  manualBookings: ManualBookingBlock[];
  onAdd: () => void;
  onRemove: (booking: ManualBookingBlock) => void;
  rooms: Room[];
}) {
  return (
    <View style={styles.section}>
      <Text variant="titleMedium">Rooms by category</Text>
      <Text style={{ color: ownerColors.muted }} variant="bodySmall">
        Available for your selected dates is checked with live inventory. Room badges show current
        physical status.
      </Text>
      {availability.isLoading ? <ActivityIndicator /> : null}
      <FormErrorBanner message={availability.errorMessage} />
      {roomTypes.map((type) => (
        <Card key={type.id} mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">{type.name}</Text>
            <Text style={{ color: ownerColors.muted }} variant="bodySmall">
              Total: {rooms.filter((room) => room.roomTypeId === type.id).length} ·{' '}
              {type.isActive
                ? `Available for selected dates: ${availability.isLoading ? 'Checking…' : (availability.data[type.id]?.availableRoomCount ?? 'Not verified')}`
                : 'Inactive category'}
            </Text>
            {rooms
              .filter((room) => room.roomTypeId === type.id)
              .map((room) => (
                <View key={room.id} style={styles.roomRow}>
                  <Text style={{ flex: 1 }} variant="bodyMedium">
                    Room {room.roomNumber}
                  </Text>
                  <StatusBadge
                    label={formatStatus(room.status)}
                    tone={
                      room.status === 'AVAILABLE'
                        ? 'success'
                        : room.status === 'OCCUPIED'
                          ? 'danger'
                          : 'warning'
                    }
                  />
                </View>
              ))}
          </Card.Content>
        </Card>
      ))}
      <Text variant="titleMedium">Current room status</Text>
      <Text style={{ color: ownerColors.muted }} variant="bodySmall">
        Open the Rooms tab above to update a room, housekeeping note or maintenance status.
      </Text>
      <Button disabled={rooms.length === 0} icon="calendar-plus" mode="contained" onPress={onAdd}>
        Add Manual Booking
      </Button>
      <Text variant="bodyMedium">
        Record phone or walk-in bookings here. The selected room is blocked for those nights in live
        pilgrim availability.
      </Text>
      {manualBookings.length === 0 ? (
        <EmptyState
          title="No offline bookings"
          description="Bookings received outside the app will appear here."
        />
      ) : null}
      {manualBookings.map((booking) => (
        <Card key={booking.id} mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.titleBlock}>
                <Text variant="titleMedium">{booking.guestName}</Text>
                <Text variant="bodySmall">
                  Room {booking.roomNumber} · {booking.guestPhone}
                </Text>
              </View>
              <Chip>Offline booking</Chip>
            </View>
            <Text variant="bodyMedium">
              {formatBookingDate(booking.checkInDate)} to {formatBookingDate(booking.checkOutDate)}
            </Text>
            {booking.notes ? <Text variant="bodySmall">{booking.notes}</Text> : null}
            <Button
              disabled={isSubmitting}
              icon="calendar-remove"
              mode="outlined"
              textColor="#B3261E"
              onPress={() => onRemove(booking)}
            >
              Remove and release room
            </Button>
          </Card.Content>
        </Card>
      ))}
    </View>
  );
}

function GalleryTab({ onAdd, photos }: { onAdd: () => void; photos: LodgePhoto[] }) {
  return (
    <View style={styles.section}>
      <Button icon="image-plus" mode="contained" onPress={onAdd}>
        Add Photos
      </Button>
      <Text variant="bodySmall">
        Choose photos from your device. They upload automatically and go live after admin approval.
      </Text>
      {photos.length === 0 ? (
        <EmptyState title="No photos" description="Submitted lodge photos will appear here." />
      ) : null}
      {photos.map((photo) => (
        <GalleryPhotoCard key={photo.id} photo={photo} />
      ))}
    </View>
  );
}

function GalleryPhotoCard({ photo }: { photo: LodgePhoto }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const imageUrl = photo.thumbnailUrl ?? photo.fileUrl;

  return (
    <Card key={photo.id} mode="outlined" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium">{formatStatus(photo.category)}</Text>
          <Chip>{getPhotoStatusLabel(photo)}</Chip>
        </View>
        {failed ? (
          <View style={[styles.imageFallback, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="bodyMedium">Image preview unavailable</Text>
          </View>
        ) : (
          <Image
            accessibilityLabel={`${formatStatus(photo.category)} photo preview`}
            resizeMode="cover"
            source={{ uri: imageUrl }}
            style={styles.galleryImage}
            onError={() => setFailed(true)}
          />
        )}
        <Text numberOfLines={2} variant="bodySmall">
          {photo.fileUrl}
        </Text>
        {photo.isCover ? <Text variant="bodySmall">Cover photo</Text> : null}
        {photo.rejectionReason ? <Text variant="bodySmall">{photo.rejectionReason}</Text> : null}
      </Card.Content>
    </Card>
  );
}

function RoomTypeModal({
  initial,
  errorMessage,
  isSubmitting,
  onClose,
  onSubmit,
  visible,
}: {
  initial: RoomType | null;
  errorMessage: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    basePrice: number;
    capacityAdults: number;
    capacityChildren: number;
    description?: string;
    festivalPrice?: number;
    name: string;
    slug: string;
    totalRooms: number;
  }) => void;
  visible: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [capacityAdults, setCapacityAdults] = useState('2');
  const [capacityChildren, setCapacityChildren] = useState('0');
  const [basePrice, setBasePrice] = useState('');
  const [festivalPrice, setFestivalPrice] = useState('');
  const [totalRooms, setTotalRooms] = useState('1');

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setCapacityAdults(String(initial?.capacityAdults ?? 2));
    setCapacityChildren(String(initial?.capacityChildren ?? 0));
    setBasePrice(initial?.basePrice ?? '');
    setFestivalPrice(initial?.festivalPrice ?? '');
    setTotalRooms(String(initial?.totalRooms ?? 1));
  }, [initial, visible]);
  const valid =
    name.trim().length > 0 &&
    name.trim().length <= 120 &&
    basePrice.trim() !== '' &&
    Number.isFinite(Number(basePrice)) &&
    Number(basePrice) >= 0 &&
    Number.isInteger(Number(capacityAdults)) &&
    Number(capacityAdults) >= 1 &&
    Number.isInteger(Number(capacityChildren)) &&
    Number(capacityChildren) >= 0 &&
    Number.isInteger(Number(totalRooms)) &&
    Number(totalRooms) >= 1 &&
    (!festivalPrice || (Number.isFinite(Number(festivalPrice)) && Number(festivalPrice) >= 0));

  return (
    <FormModal
      errorMessage={errorMessage}
      title={initial ? 'Edit room category' : 'Add room category'}
      visible={visible}
      onClose={onClose}
    >
      <TextInput
        accessibilityLabel="Name"
        outlineStyle={{ borderRadius: radius.md }}
        label="Name"
        mode="outlined"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        accessibilityLabel="Description"
        outlineStyle={{ borderRadius: radius.md }}
        label="Description"
        mode="outlined"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        accessibilityLabel="Adult capacity"
        outlineStyle={{ borderRadius: radius.md }}
        keyboardType="number-pad"
        label="Adult capacity"
        mode="outlined"
        value={capacityAdults}
        onChangeText={setCapacityAdults}
      />
      <TextInput
        accessibilityLabel="Children capacity"
        outlineStyle={{ borderRadius: radius.md }}
        keyboardType="number-pad"
        label="Children capacity"
        mode="outlined"
        value={capacityChildren}
        onChangeText={setCapacityChildren}
      />
      <TextInput
        accessibilityLabel="Base price"
        outlineStyle={{ borderRadius: radius.md }}
        keyboardType="decimal-pad"
        label="Base price"
        mode="outlined"
        value={basePrice}
        onChangeText={setBasePrice}
      />
      <TextInput
        accessibilityLabel="Festival price optional"
        outlineStyle={{ borderRadius: radius.md }}
        keyboardType="decimal-pad"
        label="Festival price optional"
        mode="outlined"
        value={festivalPrice}
        onChangeText={setFestivalPrice}
      />
      <TextInput
        accessibilityLabel="Total rooms"
        outlineStyle={{ borderRadius: radius.md }}
        keyboardType="number-pad"
        label="Total rooms"
        mode="outlined"
        value={totalRooms}
        onChangeText={setTotalRooms}
      />
      <Text variant="bodySmall">
        Festival pricing affects booking estimates. Confirm before saving.
        {initial?.festivalPrice ? ' Leaving festival price blank keeps the current rate.' : ''}
      </Text>
      <Button
        disabled={!valid || isSubmitting}
        loading={isSubmitting}
        mode="contained"
        onPress={() =>
          onSubmit({
            basePrice: Number(basePrice),
            capacityAdults: Number(capacityAdults),
            capacityChildren: Number(capacityChildren),
            description: description.trim(),
            festivalPrice: festivalPrice ? Number(festivalPrice) : undefined,
            name: name.trim(),
            slug: slugify(name),
            totalRooms: Number(totalRooms),
          })
        }
      >
        Save Room Type
      </Button>
    </FormModal>
  );
}

function RoomModal({
  initial,
  errorMessage,
  isSubmitting,
  onClose,
  onSubmit,
  roomTypes,
  visible,
}: {
  initial: Room | null;
  errorMessage: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (roomTypeId: string, input: { floor?: string; roomNumber: string }) => void;
  roomTypes: RoomType[];
  visible: boolean;
}) {
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? '');
  const [roomNumber, setRoomNumber] = useState('');
  const [floor, setFloor] = useState('');

  useEffect(() => {
    if (!visible) return;
    setRoomTypeId(initial?.roomTypeId ?? '');
    setRoomNumber(initial?.roomNumber ?? '');
    setFloor(initial?.floor ?? '');
  }, [initial, visible]);
  useEffect(() => {
    if (visible && !roomTypeId && roomTypes[0]) setRoomTypeId(roomTypes[0].id);
  }, [roomTypeId, roomTypes, visible]);
  return (
    <FormModal
      errorMessage={errorMessage}
      title={initial ? 'Edit room' : 'Add room'}
      visible={visible}
      onClose={onClose}
    >
      <View style={styles.chips}>
        {roomTypes.map((roomType) => (
          <Chip
            disabled={Boolean(initial)}
            key={roomType.id}
            selected={roomTypeId === roomType.id}
            onPress={() => setRoomTypeId(roomType.id)}
          >
            {roomType.name}
          </Chip>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Room number"
        outlineStyle={{ borderRadius: radius.md }}
        label="Room number"
        mode="outlined"
        value={roomNumber}
        onChangeText={setRoomNumber}
      />
      <TextInput
        accessibilityLabel="Floor"
        outlineStyle={{ borderRadius: radius.md }}
        label="Floor"
        mode="outlined"
        value={floor}
        onChangeText={setFloor}
      />
      <Button
        disabled={
          !roomTypeId ||
          !roomNumber.trim() ||
          roomNumber.trim().length > 40 ||
          floor.length > 40 ||
          isSubmitting
        }
        loading={isSubmitting}
        mode="contained"
        onPress={() => onSubmit(roomTypeId, { floor: floor.trim(), roomNumber: roomNumber.trim() })}
      >
        Save Room
      </Button>
    </FormModal>
  );
}

function ManualBookingModal({
  errorMessage,
  isSubmitting,
  onClose,
  onSubmit,
  rooms,
  visible,
}: {
  errorMessage: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (
    roomId: string,
    input: {
      checkInDate: string;
      checkOutDate: string;
      guestName: string;
      guestPhone: string;
      notes?: string;
    },
  ) => void;
  rooms: Room[];
  visible: boolean;
}) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [checkInDate, setCheckInDate] = useState(toDateInput(new Date()));
  const [checkOutDate, setCheckOutDate] = useState(toDateInput(new Date(Date.now() + 86_400_000)));
  const [notes, setNotes] = useState('');
  const normalizedPhone = normalizeIndianPhone(guestPhone);
  const datesValid =
    /^\d{4}-\d{2}-\d{2}$/u.test(checkInDate) &&
    /^\d{4}-\d{2}-\d{2}$/u.test(checkOutDate) &&
    checkInDate < checkOutDate;

  useEffect(() => {
    if (!rooms.some((room) => room.id === roomId)) {
      setRoomId(rooms[0]?.id ?? '');
    }
  }, [roomId, rooms]);

  return (
    <FormModal
      errorMessage={errorMessage}
      title="Offline Booking"
      visible={visible}
      onClose={onClose}
    >
      <Text variant="bodySmall">
        Use this for bookings received by phone, at the counter, or through another channel.
      </Text>
      <View style={styles.chips}>
        {rooms.map((room) => (
          <Chip key={room.id} selected={roomId === room.id} onPress={() => setRoomId(room.id)}>
            Room {room.roomNumber}
          </Chip>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Guest name"
        outlineStyle={{ borderRadius: radius.md }}
        label="Guest name"
        mode="outlined"
        value={guestName}
        onChangeText={setGuestName}
      />
      <TextInput
        accessibilityLabel="Guest mobile number"
        outlineStyle={{ borderRadius: radius.md }}
        keyboardType="phone-pad"
        label="Guest mobile number"
        mode="outlined"
        placeholder="9876543210"
        value={guestPhone}
        onChangeText={setGuestPhone}
      />
      <TextInput
        accessibilityLabel="Check-in date (YYYY-MM-DD)"
        outlineStyle={{ borderRadius: radius.md }}
        autoCapitalize="none"
        label="Check-in date (YYYY-MM-DD)"
        mode="outlined"
        value={checkInDate}
        onChangeText={setCheckInDate}
      />
      <TextInput
        accessibilityLabel="Check-out date (YYYY-MM-DD)"
        outlineStyle={{ borderRadius: radius.md }}
        autoCapitalize="none"
        label="Check-out date (YYYY-MM-DD)"
        mode="outlined"
        value={checkOutDate}
        onChangeText={setCheckOutDate}
      />
      <TextInput
        accessibilityLabel="Notes (optional)"
        outlineStyle={{ borderRadius: radius.md }}
        label="Notes (optional)"
        mode="outlined"
        multiline
        value={notes}
        onChangeText={setNotes}
      />
      <Button
        disabled={!roomId || !guestName.trim() || !normalizedPhone || !datesValid || isSubmitting}
        loading={isSubmitting}
        mode="contained"
        onPress={() =>
          normalizedPhone &&
          onSubmit(roomId, {
            checkInDate,
            checkOutDate,
            guestName: guestName.trim(),
            guestPhone: normalizedPhone,
            notes: notes.trim() || undefined,
          })
        }
      >
        Save and block room
      </Button>
    </FormModal>
  );
}

function PhotoMetadataModal({
  errorMessage,
  isSubmitting,
  onClose,
  onSubmit,
  onUploadPhoto,
  visible,
}: {
  errorMessage: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (
    inputs: Array<{
      category: PhotoCategory;
      fileUrl: string;
      isCover?: boolean;
      thumbnailUrl?: string;
    }>,
  ) => void;
  onUploadPhoto: (photo: PickedPhoto) => Promise<{ fileUrl: string }>;
  visible: boolean;
}) {
  const [category, setCategory] = useState<PhotoCategory>('ROOM');
  const [isCover, setIsCover] = useState(false);
  const [pickedImages, setPickedImages] = useState<PickedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const busy = isSubmitting || isUploading;

  const resetForm = () => {
    setPickedImages([]);
    setIsCover(false);
    setUploadError(null);
  };

  const handleClose = () => {
    if (busy) {
      return;
    }
    resetForm();
    onClose();
  };

  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError('Allow photo library access to add photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      quality: 0.8,
      selectionLimit: 10,
    });

    if (result.canceled) {
      return;
    }

    const newImages: PickedPhoto[] = result.assets.map((asset, index) => ({
      fileName: asset.fileName ?? `photo-${Date.now()}-${index}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    }));

    setPickedImages((current) => [...current, ...newImages]);
    setUploadError(null);
  };

  const handleRemoveImage = (index: number) => {
    setPickedImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async () => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const inputs: Array<{
        category: PhotoCategory;
        fileUrl: string;
        isCover?: boolean;
        thumbnailUrl?: string;
      }> = [];

      for (let index = 0; index < pickedImages.length; index += 1) {
        const uploaded = await onUploadPhoto(pickedImages[index]);
        inputs.push({
          category,
          fileUrl: uploaded.fileUrl,
          isCover: index === 0 ? isCover : false,
          thumbnailUrl: uploaded.fileUrl,
        });
      }

      onSubmit(inputs);
      resetForm();
    } catch {
      setUploadError('Upload failed. Check your connection and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <FormModal
      errorMessage={errorMessage}
      title="Add Photos"
      visible={visible}
      onClose={handleClose}
    >
      <View style={styles.chips}>
        {photoCategories.map((item) => (
          <Chip key={item} selected={category === item} onPress={() => setCategory(item)}>
            {formatStatus(item)}
          </Chip>
        ))}
      </View>

      <Button
        disabled={busy}
        icon="image-plus"
        mode="outlined"
        onPress={() => {
          void handlePickImages();
        }}
      >
        Choose Photos
      </Button>

      {pickedImages.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.thumbnailRow}>
            {pickedImages.map((image, index) => (
              <View key={`${image.uri}-${index}`} style={styles.thumbnailWrapper}>
                <Image source={{ uri: image.uri }} style={styles.thumbnailImage} />
                <IconButton
                  accessibilityLabel="Remove photo"
                  containerColor="rgba(0, 0, 0, 0.6)"
                  disabled={busy}
                  icon="close"
                  iconColor="#FFFFFF"
                  size={14}
                  style={styles.thumbnailRemoveButton}
                  onPress={() => handleRemoveImage(index)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <EmptyState
          title="No photos selected"
          description="Choose one or more photos from your device to upload."
        />
      )}

      <Chip
        disabled={pickedImages.length === 0}
        selected={isCover}
        onPress={() => setIsCover((current) => !current)}
      >
        Set first photo as cover
      </Chip>

      <FormErrorBanner message={uploadError} />

      <Button
        disabled={pickedImages.length === 0 || busy}
        loading={busy}
        mode="contained"
        onPress={() => {
          void handleSubmit();
        }}
      >
        {isUploading
          ? 'Uploading...'
          : `Upload ${pickedImages.length} Photo${pickedImages.length === 1 ? '' : 's'}`}
      </Button>
    </FormModal>
  );
}

function FormModal({
  children,
  errorMessage,
  onClose,
  title,
  visible,
}: PropsWithChildren<{
  errorMessage?: string | null;
  onClose: () => void;
  title: string;
  visible: boolean;
}>) {
  const theme = useTheme();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalBackdrop}
      >
        <Card mode="elevated" style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={[styles.cardContent, { flexShrink: 1 }]}>
            <View style={styles.cardHeader}>
              <Text variant="titleLarge">{title}</Text>
              <Button onPress={onClose}>Close</Button>
            </View>
            <FormErrorBanner message={errorMessage ?? null} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={styles.modalContent}
            >
              {children}
            </ScrollView>
          </Card.Content>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getRoomStatusCounts(rooms: Room[]): Partial<Record<RoomStatus, number>> {
  return rooms.reduce<Partial<Record<RoomStatus, number>>>((counts, room) => {
    counts[room.status] = (counts[room.status] ?? 0) + 1;
    return counts;
  }, {});
}

function getPhotoStatusLabel(photo: LodgePhoto): string {
  if (photo.approvalStatus === 'APPROVED') {
    return 'Visible to pilgrims';
  }

  if (photo.approvalStatus === 'REJECTED') {
    return 'Rejected by admin';
  }

  return 'Waiting for admin approval';
}

function formatStatus(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatMoney(value: string): string {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return parsed.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatBookingDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeIndianPhone(value: string): string | null {
  const digits = value.replace(/\D/gu, '');
  const nationalDigits = digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/u.test(nationalDigits) ? `+91${nationalDigits}` : null;
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', gap: 10 },
  dateCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ownerColors.border,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 6,
    minHeight: 72,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ownerColors.border,
    paddingTop: 12,
  },
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  container: {
    flex: 1,
  },
  focusedCard: {
    borderColor: ownerColors.primary,
    borderWidth: 2,
  },
  header: {
    gap: spacing.xs,
  },
  galleryImage: {
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    width: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    justifyContent: 'center',
    width: '100%',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.sm,
    maxHeight: '88%',
  },
  modalContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  summaryCard: {
    borderRadius: radius.sm,
    flex: 1,
    minWidth: 0,
  },
  summaryContent: {
    gap: spacing.xs,
    minHeight: 70,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumbnailImage: {
    borderRadius: radius.sm,
    height: 84,
    width: 84,
  },
  thumbnailRemoveButton: {
    margin: 0,
    position: 'absolute',
    right: -8,
    top: -8,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
