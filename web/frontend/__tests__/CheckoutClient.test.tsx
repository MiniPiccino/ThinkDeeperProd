import { act, render, screen, waitFor } from '@testing-library/react';
import { initializePaddle } from '@paddle/paddle-js';
import { useRouter, useSearchParams } from 'next/navigation';

import { CheckoutClient } from '@/app/checkout/CheckoutClient';
import { useAuth } from '@/app/providers';
import { confirmPaddleTransaction } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(),
}));

vi.mock('@paddle/paddle-js', () => ({
  initializePaddle: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/app/providers', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  confirmPaddleTransaction: vi.fn(),
}));

vi.mock('@/lib/environment', () => ({
  assertStagingPublicConfiguration: vi.fn(),
}));

const TRANSACTION_ID = 'txn_0123456789abcdefghijklmnop';
const mockInitializePaddle = vi.mocked(initializePaddle);
const mockUseRouter = vi.mocked(useRouter);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseAuth = vi.mocked(useAuth);
const mockConfirmTransaction = vi.mocked(confirmPaddleTransaction);
const checkoutOpen = vi.fn();
const replace = vi.fn();
const invalidateQueries = vi.fn().mockResolvedValue(undefined);

function getCheckoutEventCallback() {
  const firstCall = mockInitializePaddle.mock.calls.at(0);
  const eventCallback = firstCall?.[0]?.eventCallback;
  if (!eventCallback) {
    throw new Error('Paddle event callback was not registered.');
  }
  return eventCallback;
}

describe('CheckoutClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = 'test_sandbox_token';
    process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT = 'sandbox';
    mockUseRouter.mockReturnValue({ replace } as never);
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ _ptxn: TRANSACTION_ID }) as never);
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } as never, loading: false });
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries } as never);
    mockInitializePaddle.mockResolvedValue({ Checkout: { open: checkoutOpen } } as never);
    mockConfirmTransaction.mockResolvedValue({ confirmed: true });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    delete process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
  });

  it('initializes Paddle sandbox and opens the server-created transaction', async () => {
    render(<CheckoutClient />);

    await waitFor(() => expect(mockInitializePaddle).toHaveBeenCalledTimes(1));
    expect(mockInitializePaddle).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'sandbox', token: 'test_sandbox_token' }),
    );
    expect(checkoutOpen).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: TRANSACTION_ID }),
    );
    expect(screen.getByText('Complete the test checkout in the secure Paddle overlay.')).toBeInTheDocument();
  });

  it('shows configuration errors without initializing Paddle', () => {
    delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

    render(<CheckoutClient />);

    expect(screen.getByText('Paddle sandbox is not configured.')).toBeInTheDocument();
    expect(mockInitializePaddle).not.toHaveBeenCalled();
  });

  it('reports a Paddle initialization failure', async () => {
    mockInitializePaddle.mockRejectedValue(new Error('unavailable'));

    render(<CheckoutClient />);

    expect(await screen.findByText('Paddle sandbox checkout could not be opened.')).toBeInTheDocument();
    expect(checkoutOpen).not.toHaveBeenCalled();
  });

  it('confirms the completed transaction and routes to Growth', async () => {
    render(<CheckoutClient />);
    await waitFor(() => expect(mockInitializePaddle).toHaveBeenCalled());
    const eventCallback = getCheckoutEventCallback();

    await act(async () => {
      await eventCallback({
        name: 'checkout.completed',
        data: { transaction_id: TRANSACTION_ID },
      } as never);
    });

    expect(mockConfirmTransaction).toHaveBeenCalledWith(TRANSACTION_ID);
    expect(replace).toHaveBeenCalledWith('/growth?plan=premium');
  });

  it('shows a processing message when confirmation is not ready', async () => {
    mockConfirmTransaction.mockRejectedValue(new Error('retry later'));
    render(<CheckoutClient />);
    await waitFor(() => expect(mockInitializePaddle).toHaveBeenCalled());
    const eventCallback = getCheckoutEventCallback();

    await act(async () => {
      await eventCallback({
        name: 'checkout.completed',
        data: { transaction_id: TRANSACTION_ID },
      } as never);
    });

    expect(
      screen.getByText('Payment was accepted, but activation is still processing. Refresh Growth shortly.'),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
