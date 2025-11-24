import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useQuery} from '@tanstack/react-query';

import {fetchDailyQuestion, type DailyQuestionResponse} from '../api';
import {useUserIdentifier} from '../hooks/useUserIdentifier';

export function FocusTools(): React.JSX.Element {
  const userId = useUserIdentifier();
  const {data, isLoading, isError, refetch} = useQuery({
    queryKey: ['focus-tools', userId],
    queryFn: () => fetchDailyQuestion(userId ?? undefined),
    enabled: Boolean(userId),
  });

  const dopamine = data?.dopamine;
  const nextWeekLabel = useMemo(() => {
    if (!data) {
      return 'Next arc arrives soon';
    }
    return data.nextTheme ?? data.theme ?? 'Your next arc';
  }, [data]);
  const xpTotal = data?.xpTotal ?? 0;
  const levelStats = computeLevelStats(xpTotal);
  const streakCount = data?.streak ?? 0;
  const weekProgress =
    data?.weekProgress ?? {completedDays: 0, totalDays: 7, badgeEarned: false};
  const badgeName = data?.theme
    ? (() => {
        const badgeLabelParts = data.theme
          .split('—')
          .map(part => part.trim())
          .filter(Boolean);
        const badgeBase =
          badgeLabelParts[badgeLabelParts.length - 1] ?? data.theme;
        return `${badgeBase} Insight Badge`;
      })()
    : undefined;
  const remainingDays = Math.max(
    0,
    weekProgress.totalDays - weekProgress.completedDays,
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Deep focus tools</Text>
        <Text style={styles.title}>Prime today&apos;s flow when you need it</Text>
        <Text style={styles.subtitle}>
          Step out of the main session, recalibrate, then drop back in without
          cluttering your writing surface.
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <PillButton label="Refresh focus tools" onPress={() => refetch()} />
        <View style={styles.nextWeekCard}>
          <Text style={styles.nextWeekLabel}>Next week</Text>
          <Text style={styles.nextWeekTitle}>{nextWeekLabel}</Text>
          <Text style={styles.nextWeekHint}>
            Invite someone to start this arc with you.
          </Text>
        </View>
      </View>

      {!userId ? (
        <Notice text="Connecting to your streak..." tone="muted" />
      ) : null}

      {!isLoading && !isError && userId ? (
        <>
          <View style={styles.statsRow}>
            <StatCard title="Level" value={`Level ${levelStats.level}`}>
              <Text style={styles.body}>
                {levelStats.xpIntoLevel} XP into this tier ·{' '}
                {levelStats.xpToNextLevel} until next
              </Text>
            </StatCard>
            <StatCard title="Streak" value={`${streakCount} days`}>
              <Text style={styles.body}>
                {remainingDays === 0
                  ? 'This loop is in full bloom.'
                  : `${remainingDays} day${
                      remainingDays === 1 ? '' : 's'
                    } left to close the loop.`}
              </Text>
            </StatCard>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionKicker}>Streak intel</Text>
            <Text style={styles.sectionTitle}>
              Level {levelStats.level} | {streakCount} day streak
            </Text>
            <View style={styles.bulletList}>
              <Bullet>
                Completed days leaf out.{' '}
                {remainingDays === 0
                  ? 'This loop is in full bloom.'
                  : `${remainingDays} day${
                      remainingDays === 1 ? '' : 's'
                    } left to close the loop.`}
              </Bullet>
              <Bullet>
                Badge unlock:{' '}
                {weekProgress.badgeEarned
                  ? 'claimed for this arc.'
                  : `${badgeName ?? 'Weekly Insight'} once you finish the week.`}
              </Bullet>
              <Bullet>
                XP pacing:{' '}
                {levelStats.xpToNextLevel > 0
                  ? `${levelStats.xpToNextLevel} XP until the next tier.`
                  : 'Next tier unlocked—keep stacking.'}
              </Bullet>
            </View>
          </View>
        </>
      ) : null}

      {isLoading ? (
        <LoadingCard text="Loading focus tools..." />
      ) : null}

      {isError ? (
        <Notice
          text="Couldn't load today's focus tools. Check your connection or try again."
          tone="error"
        />
      ) : null}

      {dopamine ? (
        <View style={styles.grid}>
          <DopamineCard
            title="Curiosity spark"
            description={
              dopamine.curiosityHook ??
              'Prime your mind for today’s theme. Use the reflections that resonate most.'
            }
            items={
              dopamine.curiosityPrompts?.filter(Boolean) ?? [
                'Notice the bias that keeps resurfacing.',
                'Name one assumption you can test today.',
              ]
            }
          />
          <DopamineCard
            title="Challenge fuel"
            description="Pick the stretch tier that fits your energy."
            items={
              dopamine.challengeModes?.map(mode => {
                const emphasis = mode.multiplier
                  ? `x${mode.multiplier.toFixed(2)} XP`
                  : undefined;
                return `${mode.label}${emphasis ? ` · ${emphasis}` : ''}`;
              }) ?? []
            }
            footer={dopamine.activeDifficulty}
          />
          <DopamineCard
            title="Reward signal"
            description={
              dopamine.rewardHighlights?.length
                ? 'Snapshots tuned to your streak.'
                : 'See your wins stack up.'
            }
            items={
              dopamine.rewardHighlights?.slice(0, 3).map(highlight => {
                const status = highlight.earned ? 'Unlocked' : 'In progress';
                return `${highlight.title} — ${status}`;
              }) ?? []
            }
          />
          <DopamineCard
            title="Anticipation cue"
            description={
              dopamine.anticipationTeaser ??
              'Set tomorrow up before you close today.'
            }
            items={[
              ...(dopamine.curiosityPrompts?.slice(0, 1) ?? []),
              'Block out five minutes for tomorrow now.',
              'Capture one insight to revisit next session.',
            ]}
            footer={
              dopamine.nextPromptAvailableAt
                ? new Date(dopamine.nextPromptAvailableAt).toLocaleString(
                    undefined,
                    {
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    },
                  )
                : undefined
            }
          />
        </View>
      ) : (
        !isLoading &&
        !isError && <Notice text="Focus tools are not available yet." />
      )}
    </ScrollView>
  );
}

type LevelStats = {
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
};

const XP_PER_LEVEL = 120;

function computeLevelStats(totalXp: number): LevelStats {
  if (totalXp < 0) {
    totalXp = 0;
  }
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const previousThreshold = (level - 1) * XP_PER_LEVEL;
  const xpIntoLevel = totalXp - previousThreshold;
  const xpToNextLevel = Math.max(0, level * XP_PER_LEVEL - totalXp);
  const progressPercent = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);
  return {
    level,
    xpIntoLevel,
    xpToNextLevel,
    progressPercent: Math.max(0, Math.min(progressPercent, 100)),
  };
}

function PillButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({pressed}) => [styles.pill, pressed && styles.pillPressed]} onPress={onPress}>
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

function Notice({text, tone = 'muted'}: {text: string; tone?: 'muted' | 'error'}) {
  const toneStyle = tone === 'error' ? styles.noticeError : styles.noticeMuted;
  return (
    <View style={[styles.notice, toneStyle]}>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function LoadingCard({text}: {text: string}) {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator color="#34d399" />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

function StatCard({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statKicker}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {children}
    </View>
  );
}

function Bullet({children}: {children: React.ReactNode}) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

function DopamineCard({
  title,
  description,
  items,
  footer,
}: {
  title: string;
  description: string;
  items: string[];
  footer?: string;
}) {
  return (
    <View style={styles.dopamineCard}>
      <Text style={styles.dopamineTitle}>{title}</Text>
      <Text style={styles.dopamineDescription}>{description}</Text>
      {items.map(item => (
        <Text key={item} style={styles.dopamineItem}>
          • {item}
        </Text>
      ))}
      {footer ? <Text style={styles.dopamineFooter}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  kicker: {
    color: '#34d399',
    letterSpacing: 3,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#e2e8f0',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  actionsRow: {
    gap: 12,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pillPressed: {
    opacity: 0.8,
    transform: [{scale: 0.98}],
  },
  pillText: {
    color: '#ecfeff',
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  nextWeekCard: {
    borderRadius: 16,
    borderColor: 'rgba(148,163,184,0.4)',
    borderWidth: 1,
    padding: 14,
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  nextWeekLabel: {
    color: '#94a3b8',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  nextWeekTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    marginTop: 6,
  },
  nextWeekHint: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    borderRadius: 16,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    padding: 14,
    gap: 6,
  },
  statKicker: {
    color: '#a7f3d0',
    letterSpacing: 2,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#ecfeff',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    padding: 16,
    gap: 8,
  },
  sectionKicker: {
    color: '#a7f3d0',
    letterSpacing: 2,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#ecfeff',
    fontSize: 16,
    fontWeight: '700',
  },
  bulletList: {
    gap: 6,
    marginTop: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: '#34d399',
  },
  notice: {
    borderRadius: 12,
    padding: 14,
  },
  noticeMuted: {
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderColor: 'rgba(148,163,184,0.35)',
    borderWidth: 1,
  },
  noticeError: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderColor: 'rgba(248,113,113,0.4)',
    borderWidth: 1,
  },
  noticeText: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.15)',
  },
  loadingText: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dopamineCard: {
    flex: 1,
    minWidth: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
    padding: 14,
    gap: 6,
  },
  dopamineTitle: {
    color: '#ecfeff',
    fontWeight: '700',
    fontSize: 15,
  },
  dopamineDescription: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  dopamineItem: {
    color: '#a7f3d0',
    fontSize: 13,
  },
  dopamineFooter: {
    color: '#e2e8f0',
    fontSize: 12,
    marginTop: 4,
  },
});
