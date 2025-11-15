import { fireEvent, render, screen } from "@testing-library/react";
import { AnswerForm } from "@/components/AnswerForm";
import { vi } from "vitest";

describe("AnswerForm", () => {
  it("calls onSubmit when filled", () => {
    const handleSubmit = vi.fn();
    const handleChange = vi.fn();
    render(
      <AnswerForm
        answer="Thoughts"
        onChange={handleChange}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    const form = screen.getByRole("form", { name: /answer form/i });
    fireEvent.submit(form);
    expect(handleSubmit).toHaveBeenCalled();
  });

  it("disables button while submitting", () => {
    render(
      <AnswerForm
        answer="Idea"
        onChange={() => {}}
        onSubmit={() => {}}
        isSubmitting
      />,
    );

    expect(screen.getByRole("button", { name: /scoring/i })).toBeDisabled();
  });

  it("updates through onChange handler", () => {
    const handleChange = vi.fn();
    render(
      <AnswerForm
        answer=""
        onChange={handleChange}
        onSubmit={() => {}}
        isSubmitting={false}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "New thought" },
    });

    expect(handleChange).toHaveBeenCalledWith("New thought");
  });
});
