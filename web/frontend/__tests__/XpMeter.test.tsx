import { render, screen } from "@testing-library/react";
import { XpMeter } from "@/components/XpMeter";

describe("XpMeter", () => {
  it("renders xp totals", () => {
    render(
      <XpMeter
        totalXp={45}
        xpGain={10}
        baseGain={10}
        bonusGain={0}
        level={1}
        xpIntoLevel={45}
        xpToNextLevel={75}
        levelProgressPercent={38}
      />,
    );
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("+10 XP")).toBeInTheDocument();
  });
});
