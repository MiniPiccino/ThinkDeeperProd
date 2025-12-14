import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const FEATURES = [
  'Daily guided reflections with feedback',
  'Export your yearly tree and streak timeline',
  'Weekly chapter badges and insight tracking',
  'Focus tools tailored to your growth themes',
];

const PLANS = [
  {
    title: 'Premium — Monthly',
    price: '€5',
    cadence: 'per month',
    ctaLabel: 'Start monthly',
    href: 'https://deepenyourmind.com/growth?plan=premium',
    highlight: 'Flexibility to pause anytime.',
  },
  {
    title: 'Premium — Yearly',
    price: '€50',
    cadence: 'per year',
    ctaLabel: 'Start yearly',
    href: 'https://deepenyourmind.com/growth?plan=premium',
    highlight: 'Save 17% vs monthly. One receipt for the year.',
  },
];

const REFUND_POLICY_URL = 'https://deepenyourmind.com/refund-policy';

export function Pricing(): React.JSX.Element {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Pricing</Text>
        <Text style={styles.title}>One plan. Think deeper.</Text>
        <Text style={styles.subtitle}>
          Pick monthly or yearly. Your reflections, streaks, and exports unlock
          on premium.
        </Text>
      </View>

      <View style={styles.planGrid}>
        {PLANS.map(plan => (
          <PricingCard key={plan.title} plan={plan} />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What&apos;s included</Text>
        <View style={styles.featureList}>
          {FEATURES.map(feature => (
            <View key={feature} style={styles.featureRow}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.section, styles.refundCard]}>
        <Text style={styles.sectionTitle}>Refund policy</Text>
        <Text style={styles.refundCopy}>
          We want Thinkle to feel valuable. If you&apos;re not happy within 14
          days of starting a plan, email us at support@deepenyourmind.com and
          we&apos;ll issue a refund for your most recent payment. Yearly plans
          can be refunded in full within 14 days; after that, cancel anytime to
          stop future renewals.
        </Text>
        <Pressable
          style={({pressed}) => [
            styles.linkButton,
            pressed && styles.linkButtonPressed,
          ]}
          onPress={() => openExternal(REFUND_POLICY_URL)}>
          <Text style={styles.linkButtonText}>Read the full refund policy</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function PricingCard({
  plan,
}: {
  plan: (typeof PLANS)[number];
}): React.JSX.Element {
  return (
    <View style={styles.planCard}>
      <View style={styles.planHeader}>
        <Text style={styles.planBadge}>Premium</Text>
        <Text style={styles.planTitle}>{plan.title}</Text>
        <Text style={styles.planHighlight}>{plan.highlight}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{plan.price}</Text>
        <Text style={styles.priceCadence}>{plan.cadence}</Text>
      </View>
      <Pressable
        style={({pressed}) => [
          styles.cta,
          pressed && styles.ctaPressed,
        ]}
        onPress={() => openExternal(plan.href)}>
        <Text style={styles.ctaText}>{plan.ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

async function openExternal(url: string) {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  } catch (error) {
    console.warn('Unable to open link', error);
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 14,
  },
  header: {
    gap: 6,
  },
  kicker: {
    color: '#a7f3d0',
    letterSpacing: 3,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#ecfeff',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  planCard: {
    flex: 1,
    minWidth: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    gap: 12,
    shadowColor: '#34d399',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
  },
  planHeader: {
    gap: 6,
  },
  planBadge: {
    color: '#a7f3d0',
    letterSpacing: 3,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  planTitle: {
    color: '#ecfeff',
    fontSize: 16,
    fontWeight: '700',
  },
  planHighlight: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  price: {
    color: '#ecfeff',
    fontSize: 32,
    fontWeight: '800',
  },
  priceCadence: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 4,
  },
  cta: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 10,
    backgroundColor: 'rgba(52,211,153,0.9)',
  },
  ctaPressed: {
    opacity: 0.85,
    transform: [{scale: 0.98}],
  },
  ctaText: {
    color: '#0b172a',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: '#ecfeff',
    fontSize: 16,
    fontWeight: '700',
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: '#34d399',
  },
  featureText: {
    color: '#cbd5e1',
    fontSize: 14,
    flex: 1,
  },
  refundCard: {
    borderColor: 'rgba(52,211,153,0.25)',
    backgroundColor: 'rgba(52,211,153,0.08)',
  },
  refundCopy: {
    color: '#a7f3d0',
    fontSize: 13,
    lineHeight: 20,
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
    backgroundColor: 'rgba(52,211,153,0.12)',
  },
  linkButtonPressed: {
    opacity: 0.85,
    transform: [{scale: 0.98}],
  },
  linkButtonText: {
    color: '#34d399',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
