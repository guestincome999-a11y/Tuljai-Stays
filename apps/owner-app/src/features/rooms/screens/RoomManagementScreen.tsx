import type {
  LodgePhoto,
  ManualBookingBlock,
  PhotoCategory,
  Room,
  RoomStatus,
  RoomType,
} from '@tuljai/types';
import { EmptyState, palette, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useOwnerAmenities } from '../../lodge-management/hooks/useOwnerAmenities';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { useRoomOperations } from '../hooks/useRoomOperations';

type RoomTab = 'AMENITIES' | 'ROOM_TYPES' | 'ROOMS' | 'AVAILABILITY' | 'GALLERY';

const tabs: Array<{ label: string; value: RoomTab }> = [
  { label: 'Amenities', value: 'AMENITIES' },
  { label: 'Room Types', value: 'ROOM_TYPES' },
  { label: 'Rooms', value: 'ROOMS' },
  { label: 'Availability', value: 'AVAILABILITY' },
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
  const params = useLocalSearchParams<{ roomId?: string; roomTypeId?: string }>();
  const assignedLodges = useAssignedLodges();
  const amenities = useOwnerAmenities();
  const rooms = useRoomOperations();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<RoomTab>('AMENITIES');
  const [roomTypeFormVisible, setRoomTypeFormVisible] = useState(false);
  const [roomFormVisible, setRoomFormVisible] = useState(false);
  const [manualBookingFormVisible, setManualBookingFormVisible] = useState(false);
  const [photoFormVisible, setPhotoFormVisible] = useState(false);
  const selectedLodgeName = assignedLodges.selectedLodge?.name ?? 'No lodge selected';
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
          <Text variant="headlineSmall">Lodge Management</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            {selectedLodgeName} · amenities, rooms, pricing and availability
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard label="Room Types" value={rooms.roomTypes.length.toString()} />
          <SummaryCard label="Total Rooms" value={rooms.rooms.length.toString()} />
          <SummaryCard label="Available" value={(statusCounts.AVAILABLE ?? 0).toString()} />
          <SummaryCard label="Amenities" value={amenities.selectedAmenities.length.toString()} />
          <SummaryCard
            label="Maintenance/Blocked"
            value={`${statusCounts.MAINTENANCE ?? 0}/${statusCounts.BLOCKED ?? 0}`}
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
            rooms.errorMessage ??
            amenities.errorMessage ??
            (rooms.isOffline ? 'Connect to the internet to update rooms.' : null)
          }
        />

        {rooms.isLoading || amenities.isLoading ? (
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
            onAdd={() => setRoomTypeFormVisible(true)}
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
            onAdd={() => setRoomFormVisible(true)}
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
            isSubmitting={rooms.isSubmitting}
            manualBookings={rooms.manualBookings}
            roomTypeById={rooms.roomTypeById}
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

      <RoomTypeModal
        isSubmitting={rooms.isSubmitting}
        visible={roomTypeFormVisible}
        onClose={() => setRoomTypeFormVisible(false)}
        onSubmit={(input) => {
          void rooms.createRoomType(input).then((saved) => {
            if (saved) {
              setRoomTypeFormVisible(false);
            }
          });
        }}
      />
      <RoomModal
        isSubmitting={rooms.isSubmitting}
        roomTypes={rooms.roomTypes}
        visible={roomFormVisible}
        onClose={() => setRoomFormVisible(false)}
        onSubmit={(roomTypeId, input) => {
          void rooms.createRoom(roomTypeId, input).then((saved) => {
            if (saved) {
              setRoomFormVisible(false);
            }
          });
        }}
      />
      <ManualBookingModal
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
        isSubmitting={rooms.isSubmitting}
        visible={photoFormVisible}
        onClose={() => setPhotoFormVisible(false)}
        onSubmit={(input) => {
          void rooms.createPhotoMetadata(input).then((saved) => {
            if (saved) {
              setPhotoFormVisible(false);
            }
          });
        }}
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
  onToggle,
  roomTypes,
}: {
  isSubmitting: boolean;
  onAdd: () => void;
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
                <Text variant="bodySmall">{roomType.description ?? 'No description'}</Text>
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
          onSaveNote={onSaveNote}
          onStatusChange={onStatusChange}
        />
      ))}
    </View>
  );
}

function RoomCard({
  focused,
  housekeepingNote,
  isSubmitting,
  onSaveNote,
  onStatusChange,
  room,
  roomType,
}: {
  focused: boolean;
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
              {roomType?.name ?? 'Room type'} - Floor {room.floor ?? 'Not set'}
            </Text>
          </View>
          <Chip>{formatStatus(room.status)}</Chip>
        </View>
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
  isSubmitting,
  manualBookings,
  onAdd,
  onRemove,
  roomTypeById,
  rooms,
}: {
  isSubmitting: boolean;
  manualBookings: ManualBookingBlock[];
  onAdd: () => void;
  onRemove: (booking: ManualBookingBlock) => void;
  roomTypeById: Map<string, RoomType>;
  rooms: Room[];
}) {
  return (
    <View style={styles.section}>
      <Button disabled={rooms.length === 0} icon="calendar-plus" mode="contained" onPress={onAdd}>
        Add Offline Booking
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
      <Text variant="titleMedium">Room Board</Text>
      {rooms.map((room) => (
        <Card key={room.id} mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text variant="titleMedium">Room {room.roomNumber}</Text>
              <Chip>{formatStatus(room.status)}</Chip>
            </View>
            <Text variant="bodySmall">
              {roomTypeById.get(room.roomTypeId)?.name ?? 'Room type'}
            </Text>
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
        Register Photo Metadata
      </Button>
      <Text variant="bodySmall">
        Upload to storage first, then submit the hosted file URL for admin approval.
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
  isSubmitting,
  onClose,
  onSubmit,
  visible,
}: {
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

  return (
    <FormModal title="Room Type" visible={visible} onClose={onClose}>
      <TextInput label="Name" mode="outlined" value={name} onChangeText={setName} />
      <TextInput
        label="Description"
        mode="outlined"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        keyboardType="number-pad"
        label="Adult capacity"
        mode="outlined"
        value={capacityAdults}
        onChangeText={setCapacityAdults}
      />
      <TextInput
        keyboardType="number-pad"
        label="Children capacity"
        mode="outlined"
        value={capacityChildren}
        onChangeText={setCapacityChildren}
      />
      <TextInput
        keyboardType="decimal-pad"
        label="Base price"
        mode="outlined"
        value={basePrice}
        onChangeText={setBasePrice}
      />
      <TextInput
        keyboardType="decimal-pad"
        label="Festival price optional"
        mode="outlined"
        value={festivalPrice}
        onChangeText={setFestivalPrice}
      />
      <TextInput
        keyboardType="number-pad"
        label="Total rooms"
        mode="outlined"
        value={totalRooms}
        onChangeText={setTotalRooms}
      />
      <Text variant="bodySmall">
        Festival pricing affects booking estimates. Confirm before saving.
      </Text>
      <Button
        disabled={!name.trim() || !Number(basePrice) || isSubmitting}
        loading={isSubmitting}
        mode="contained"
        onPress={() =>
          onSubmit({
            basePrice: Number(basePrice),
            capacityAdults: Number(capacityAdults),
            capacityChildren: Number(capacityChildren),
            description: description || undefined,
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
  isSubmitting,
  onClose,
  onSubmit,
  roomTypes,
  visible,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (roomTypeId: string, input: { floor?: string; roomNumber: string }) => void;
  roomTypes: RoomType[];
  visible: boolean;
}) {
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? '');
  const [roomNumber, setRoomNumber] = useState('');
  const [floor, setFloor] = useState('');

  return (
    <FormModal title="Physical Room" visible={visible} onClose={onClose}>
      <View style={styles.chips}>
        {roomTypes.map((roomType) => (
          <Chip
            key={roomType.id}
            selected={roomTypeId === roomType.id}
            onPress={() => setRoomTypeId(roomType.id)}
          >
            {roomType.name}
          </Chip>
        ))}
      </View>
      <TextInput
        label="Room number"
        mode="outlined"
        value={roomNumber}
        onChangeText={setRoomNumber}
      />
      <TextInput label="Floor" mode="outlined" value={floor} onChangeText={setFloor} />
      <Button
        disabled={!roomTypeId || !roomNumber.trim() || isSubmitting}
        loading={isSubmitting}
        mode="contained"
        onPress={() =>
          onSubmit(roomTypeId, { floor: floor || undefined, roomNumber: roomNumber.trim() })
        }
      >
        Save Room
      </Button>
    </FormModal>
  );
}

function ManualBookingModal({
  isSubmitting,
  onClose,
  onSubmit,
  rooms,
  visible,
}: {
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
    <FormModal title="Offline Booking" visible={visible} onClose={onClose}>
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
      <TextInput label="Guest name" mode="outlined" value={guestName} onChangeText={setGuestName} />
      <TextInput
        keyboardType="phone-pad"
        label="Guest mobile number"
        mode="outlined"
        placeholder="9876543210"
        value={guestPhone}
        onChangeText={setGuestPhone}
      />
      <TextInput
        autoCapitalize="none"
        label="Check-in date (YYYY-MM-DD)"
        mode="outlined"
        value={checkInDate}
        onChangeText={setCheckInDate}
      />
      <TextInput
        autoCapitalize="none"
        label="Check-out date (YYYY-MM-DD)"
        mode="outlined"
        value={checkOutDate}
        onChangeText={setCheckOutDate}
      />
      <TextInput
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
  isSubmitting,
  onClose,
  onSubmit,
  visible,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    category: PhotoCategory;
    fileUrl: string;
    isCover?: boolean;
    thumbnailUrl?: string;
  }) => void;
  visible: boolean;
}) {
  const [category, setCategory] = useState<PhotoCategory>('ROOM');
  const [fileUrl, setFileUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isCover, setIsCover] = useState(false);

  return (
    <FormModal title="Photo Metadata" visible={visible} onClose={onClose}>
      <View style={styles.chips}>
        {photoCategories.map((item) => (
          <Chip key={item} selected={category === item} onPress={() => setCategory(item)}>
            {formatStatus(item)}
          </Chip>
        ))}
      </View>
      <TextInput
        label="Uploaded file URL"
        mode="outlined"
        value={fileUrl}
        onChangeText={setFileUrl}
      />
      <TextInput
        label="Thumbnail URL optional"
        mode="outlined"
        value={thumbnailUrl}
        onChangeText={setThumbnailUrl}
      />
      <Chip selected={isCover} onPress={() => setIsCover((current) => !current)}>
        Cover photo
      </Chip>
      <Text variant="bodySmall">
        Storage upload is not wired in the app yet. Submit metadata only after uploading the image.
      </Text>
      <Button
        disabled={!fileUrl.trim() || isSubmitting}
        loading={isSubmitting}
        mode="contained"
        onPress={() =>
          onSubmit({
            category,
            fileUrl: fileUrl.trim(),
            isCover,
            thumbnailUrl: thumbnailUrl || undefined,
          })
        }
      >
        Submit for Approval
      </Button>
    </FormModal>
  );
}

function FormModal({
  children,
  onClose,
  title,
  visible,
}: PropsWithChildren<{ onClose: () => void; title: string; visible: boolean }>) {
  const theme = useTheme();

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <Card mode="elevated" style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text variant="titleLarge">{title}</Text>
              <Button onPress={onClose}>Close</Button>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>{children}</ScrollView>
          </Card.Content>
        </Card>
      </View>
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
    borderColor: palette.saffron[500],
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
    flexBasis: '47%',
    flexGrow: 1,
  },
  summaryContent: {
    gap: spacing.xs,
    minHeight: 88,
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
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
