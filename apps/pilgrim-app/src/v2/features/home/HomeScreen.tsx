import { Fragment, useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { refreshConfig, useRemoteConfig } from '../../core/config';
import type { LayoutSection } from '../../core/config';
import { refreshAllCached } from '../../core/useCachedFetch';
import { useColors } from '../../design/theme';
import { space } from '../../design/tokens';

import { BannersSection } from './BannersSection';
import { HeroSection } from './HeroSection';
import { LodgeRailSection } from './LodgeRailSection';
import { NoticeSection } from './NoticeSection';
import { SearchSection } from './SearchSection';
import { TrustSection } from './TrustSection';

export interface HomeScreenProps {
  onOpenAnnouncements: () => void;
  onOpenExplore: () => void;
  onOpenLodge: (lodgeId: string) => void;
}

/**
 * Renders whatever sections the admin panel has configured, in that order. Adding, hiding or
 * reordering a section changes the app on the next open — no release needed.
 */
export function HomeScreen({ onOpenAnnouncements, onOpenExplore, onOpenLodge }: HomeScreenProps) {
  const colors = useColors();
  const { config } = useRemoteConfig();
  const [refreshing, setRefreshing] = useState(false);
  const sections = config.layout.screens.home.sections.filter((section) => section.enabled);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshConfig(), refreshAllCached()]);
    setRefreshing(false);
  }, []);

  function renderSection(section: LayoutSection, index: number) {
    switch (section.type) {
      case 'HERO':
        return <HeroSection props={section.props} />;
      case 'SEARCH':
        return (
          <SearchSection
            overlapsHero={sections[index - 1]?.type === 'HERO'}
            onPress={onOpenExplore}
          />
        );
      case 'BANNERS':
        return <BannersSection settings={config.settings} />;
      case 'LODGE_RAIL':
        return (
          <LodgeRailSection
            props={section.props}
            onOpenLodge={onOpenLodge}
            onSeeAll={onOpenExplore}
          />
        );
      case 'NOTICE':
        return <NoticeSection onPress={onOpenAnnouncements} />;
      case 'TRUST_POINTS':
        return <TrustSection props={section.props} />;
      default:
        return null;
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[colors.primary]}
          progressViewOffset={space.huge}
          refreshing={refreshing}
          tintColor={colors.primary}
          onRefresh={() => void onRefresh()}
        />
      }
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: colors.background }}
    >
      {sections.map((section, index) => (
        <Fragment key={section.id}>{renderSection(section, index)}</Fragment>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.xxl, paddingBottom: space.huge * 2 },
});
