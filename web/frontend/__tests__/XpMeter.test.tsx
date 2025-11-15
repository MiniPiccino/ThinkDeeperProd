import { render, screen } from "@testing-library/react";
import { XpMeter } from "@/components/XpMeter";

describe("XpMeter", () => {
  it("renders xp totals", () => {
    render(<XpMeter totalXp={45} xpGain={10} maxXp={100} />);
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("+10 XP")).toBeInTheDocument();
  });
});
