import { render, screen, waitFor } from "@testing-library/react";
import { SubmissionCelebration } from "@/components/SubmissionCelebration";

describe("SubmissionCelebration", () => {
  it("renders celebration metrics", async () => {
    render(
      <SubmissionCelebration
        feedback="Insightful analysis."
        xpGain={12}
        baseXp={10}
        bonusXp={0}
        xpTotal={42}
        streak={3}
        durationSeconds={185}
        difficultyLevel="stretch"
        difficultyMultiplier={1.25}
        level={1}
        xpToNextLevel={78}
        xpIntoLevel={42}
        levelProgressPercent={35}
        weekCompletedDays={3}
        weekTotalDays={7}
        weekBadgeEarned={false}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Insightful analysis.")).toBeInTheDocument();
    await waitFor(() => {
      const xpGainLabel = screen.getByText(/XP gained/i);
      const xpGainValue = xpGainLabel.parentElement?.querySelector('div.mt-1');
      expect(xpGainValue?.textContent).toBe('+12');
    }, { timeout: 2000 });
    await waitFor(() => {
      const totalLabel = screen.getByText(/Total XP/i);
      const totalValue = totalLabel.parentElement?.querySelector('div.mt-1');
      expect(totalValue?.textContent).toBe('42');
    }, { timeout: 2000 });
    await waitFor(() => {
      const streakLabel = screen.getByText(/^Streak$/i);
      const streakValue = streakLabel.parentElement?.querySelector('div.mt-1');
      expect(streakValue?.textContent).toContain('3');
    }, { timeout: 2000 });
    expect(screen.getByText(/Focus time:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Great pacing\. You made space for nuance\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/3m 05s/)).toBeInTheDocument();
    expect(screen.getByText(/Next reflection unlocks tomorrow/i)).toBeInTheDocument();
  });
});
