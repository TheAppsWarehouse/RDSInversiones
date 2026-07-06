import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLanguage } from '@/hooks/useLanguage';

interface ExtraItem {
  id: string;
  name: string;
  subtitle: string;
  iconType: 'image' | 'material';
  imageUri?: string;
  iconName?: string;
  iconColor?: string;
  url: string;
}

export default function ExtrasScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { colors } = useTheme();

  const extras: ExtraItem[] = [
    {
      id: '1',
      name: 'Financial Freedom Planner',
      subtitle: 'downloadOnPlayStore',
      iconType: 'image',
      imageUri: 'https://drive.google.com/thumbnail?id=17ciCcK-faTz4bf4G3AYDUO5WXx4vPiiQ&sz=w500',
      url: 'https://play.google.com/store/apps/details?id=theappswarehouse.financialfreedomplanner.app',
    },
    {
      id: '2',
      name: 'RDS Inversiones',
      subtitle: 'rdsInversionesSub',
      iconType: 'image',
      imageUri: 'https://drive.google.com/thumbnail?id=13C-pQcBXAp3-sm7ym8a_6uv4ej2FWTyL&sz=w500',
      url: 'https://www.rdsinversiones.com',
    },
    {
      id: '3',
      name: 'Balanz',
      subtitle: 'balanzSub',
      iconType: 'image',
      imageUri: 'https://drive.google.com/thumbnail?id=10cT0g4L71Y-bJS_B7U_N68jBGVUKt0fY&sz=w500',
      url: 'https://balanz.com/abrir-cuenta-2.aspx?reference=ifa6242@balanz.work',
    },
    {
      id: '4',
      name: 'balanzInt',
      subtitle: 'balanzSub',
      iconType: 'image',
      imageUri: 'https://drive.google.com/thumbnail?id=10cT0g4L71Y-bJS_B7U_N68jBGVUKt0fY&sz=w500',
      url: 'https://www.balanz.com/abrir-cuenta-fisica-bci.aspx?reference=ifa6242@balanz.work',
    },
    {
      id: '5',
      name: 'InvertirOnline',
      subtitle: 'invertirOnlineSub',
      iconType: 'image',
      imageUri: 'https://drive.google.com/thumbnail?id=1CdsJVQIu8eFenGMOBFsZXqTvVVJOYcrL&sz=w500',
      url: 'https://micuenta.invertironline.com/registrarme?codigoAsesor=6242',
    },
    {
      id: '6',
      name: 'Instagram',
      subtitle: 'instagramSub',
      iconType: 'image',
      imageUri: 'https://drive.google.com/thumbnail?id=1Oh_bJADMOlt0O6rBrNA2Ivz2by-8nnqA&sz=w500',
      url: 'https://www.instagram.com/lucashernandezlp/',
    },
    {
      id: '7',
      name: 'YouTube',
      subtitle: 'youTubeSub',
      iconType: 'image',
      imageUri: 'https://drive.google.com/thumbnail?id=16HAY_e0JlWpe00Ev0kZgyLdCE7RVf1tf&sz=w500',
      url: 'https://www.youtube.com/@RDSinversiones',
    },
  ];

  const handlePress = async (item: ExtraItem) => {
    try {
      const supported = await Linking.canOpenURL(item.url);
      if (supported) {
        await Linking.openURL(item.url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const renderCard = (item: ExtraItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => handlePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {item.iconType === 'image' && item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={[styles.logo, { backgroundColor: colors.card }]}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: `${item.iconColor ?? colors.primary}18` }]}>
            <MaterialIcons
              name={item.iconName as any}
              size={32}
              color={item.iconColor ?? colors.primary}
            />
          </View>
        )}
      </View>

      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: colors.text }]}>{t(item.name)}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {t(item.subtitle)}
        </Text>
      </View>

      <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('extras')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {t('resourcesAndContact')}  
          </Text>
        </View>
        <MaterialIcons name="explore" size={28} color={colors.primary} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.list}>
          {extras.map((item) => renderCard(item))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  headerTitle: {
    ...typography.h2,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.bodySmall,
  },
});
