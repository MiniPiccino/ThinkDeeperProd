import { render, screen } from "@testing-library/react";

import PricingPage from "@/app/pricing/page";
import { useBillingStatus } from "@/hooks/useBillingStatus";

vi.mock("@/hooks/useBillingStatus", () => ({ useBillingStatus: vi.fn() }));
vi.mock("@/lib/api", () => ({ createCheckoutSession: vi.fn() }));

const mockStatus = vi.mocked(useBillingStatus);

function status(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "user-1" }, authLoading: false, data: {
      plan: "free", status: "inactive", premiumActive: false, expiresAt: null,
      cancelAtPeriodEnd: false, managementAvailable: false,
    }, isLoading: false, isError: false, refetch: vi.fn(), ...overrides,
  } as never;
}

describe("PricingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY = "pri_monthly";
    mockStatus.mockReturnValue(status());
  });

  it("shows an actionable monthly plan for a verified free user", () => {
    render(<PricingPage />);
    expect(screen.getByRole("button", { name: "Start monthly" })).toBeEnabled();
    expect(screen.queryByText("Premium — Yearly")).not.toBeInTheDocument();
  });

  it("shows current plan without a subscribe action for active Premium", () => {
    mockStatus.mockReturnValue(status({ data: {
      plan: "premium", status: "active", premiumActive: true, expiresAt: null,
      cancelAtPeriodEnd: false, managementAvailable: true,
    }}));
    render(<PricingPage />);
    expect(screen.getByText("Your Current Plan")).toBeInTheDocument();
    expect(screen.getAllByText("Premium Active").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /start monthly/i })).not.toBeInTheDocument();
  });

  it("shows scheduled cancellation while keeping checkout unavailable", () => {
    mockStatus.mockReturnValue(status({ data: {
      plan: "premium", status: "active", premiumActive: true,
      expiresAt: "2030-01-02T00:00:00Z", cancelAtPeriodEnd: true, managementAvailable: true,
    }}));
    render(<PricingPage />);
    expect(screen.getAllByText(/Premium active until/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /start monthly/i })).not.toBeInTheDocument();
  });

  it("allows an expired user to subscribe again", () => {
    mockStatus.mockReturnValue(status({ data: {
      plan: "free", status: "expired", premiumActive: false,
      expiresAt: "2025-01-02T00:00:00Z", cancelAtPeriodEnd: false, managementAvailable: true,
    }}));
    render(<PricingPage />);
    expect(screen.getByRole("button", { name: "Start monthly" })).toBeEnabled();
  });

  it("fails closed during loading and errors", () => {
    mockStatus.mockReturnValue(status({ isLoading: true }));
    const { rerender } = render(<PricingPage />);
    expect(screen.getByRole("button")).toBeDisabled();
    mockStatus.mockReturnValue(status({ isLoading: false, isError: true, data: undefined }));
    rerender(<PricingPage />);
    expect(screen.getByText(/Checkout is paused/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start monthly" })).toBeDisabled();
  });
});
