import { StyleSheet, View } from 'react-native';

import type { CatalogRoomType } from '../../core/catalog';
import { useColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { detailStrings, formatRupees, strings } from '../../i18n/strings';
import { Icon } from '../../ui/Icon';
import { Text } from '../../ui/Text';

export function RoomTypeRow({ room }: { room: CatalogRoomType }) {
  const colors = useColors();
  const { t } = useLang();
  const guests = room.capacityAdults + room.capacityChildren;

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.copy}>
        <Text variant="heading">{room.name}</Text>
        <View style={styles.meta}>
          <Icon color="inkMuted" name="users" size={14} />
          <Text color="inkMuted" variant="caption">
            {guests} {t(detailStrings.guests)}
          </Text>
        </View>
        {room.description ? (
          <Text color="inkMuted" numberOfLines={2} variant="caption">
            {room.description}
          </Text>
        ) : null}
      </View>
      <View style={styles.price}>
        <Text color="primary" variant="price">
          {formatRupees(room.basePrice)}
        </Text>
        <Text color="inkMuted" variant="caption">
          {t(strings.perNight)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: space.xs },
  meta: { alignItems: 'center', flexDirection: 'row', gap: space.xs },
  price: { alignItems: 'flex-end' },
  row: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.lg,
    padding: space.lg,
  },
});
