import { render, screen } from "@testing-library/react";
import { Timer } from "@/components/Timer";
import { vi } from "vitest";

describe("Timer", () => {
  it("shows formatted remaining time", () => {
    render(<Timer remainingSeconds={125} totalSeconds={300} />);
    expect(screen.getByText(/02:05/)).toBeInTheDocument();
  });

  it("invokes onExpire when time hits zero", () => {
    const handler = vi.fn();
    render(<Timer remainingSeconds={0} totalSeconds={300} onExpire={handler} />);
    expect(handler).toHaveBeenCalled();
  });
});
