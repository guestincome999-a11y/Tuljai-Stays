import { useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type { CatalogPhoto } from '../../core/catalog';
import { radius, space } from '../../design/tokens';
import { Photo } from '../../ui/Photo';
import { Text } from '../../ui/Text';

const GALLERY_HEIGHT = 320;

export function PhotoGallery({ photos, topInset }: { photos: CatalogPhoto[]; topInset: number }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const height = GALLERY_HEIGHT + topInset;

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  if (photos.length === 0) {
    return <Photo style={{ height, width }} uri={null} />;
  }

  return (
    <View style={{ height, width }}>
      <FlatList
        data={photos}
        horizontal
        keyExtractor={(photo) => photo.id}
        pagingEnabled
        renderItem={({ item }) => <Photo style={{ height, width }} uri={item.url} />}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      />
      {photos.length > 1 ? (
        <View style={styles.counter}>
          <Text color="onPrimary" variant="caption">
            {index + 1} / {photos.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    backgroundColor: 'rgba(30,14,8,0.55)',
    borderRadius: radius.pill,
    bottom: space.xxxl + space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    position: 'absolute',
    right: space.xl,
  },
});
