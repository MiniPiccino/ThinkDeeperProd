import { fireEvent, render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';

import FocusToolsPage from '@/app/focus-tools/page';
import { useAuth } from '@/app/providers';

vi.mock('@/app/providers', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/components/DopamineDrivers', () => ({ DopamineDrivers: () => null }));
vi.mock('@/components/XpMeter', () => ({ XpMeter: () => null }));
vi.mock('@/components/StreakProgress', () => ({ StreakProgress: () => null }));
vi.mock('@/components/FloatingAction', () => ({ FloatingAction: () => null }));

const mockUseAuth = vi.mocked(useAuth);
const mockUseQuery = vi.mocked(useQuery);
const refetch = vi.fn();

function mockQueries({ isLoading = false }: { isLoading?: boolean } = {}) {
  mockUseQuery.mockReturnValue({
    data: undefined,
    isLoading,
    isError: false,
    refetch,
  } as unknown as ReturnType<typeof useQuery>);
}

describe('FocusToolsPage authentication state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries();
  });

  it('shows the auth loading state only while authentication is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    render(<FocusToolsPage />);

    expect(screen.getByText('Connecting to your streak...')).toBeInTheDocument();
    expect(screen.queryByText('Sign in to use Focus Tools')).not.toBeInTheDocument();
  });

  it('shows a sign-in action and keeps queries disabled when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(<FocusToolsPage />);

    expect(screen.getByText('Sign in to use Focus Tools')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Connecting to your streak...')).not.toBeInTheDocument();
    expect(screen.queryByText('Focus tools are not available yet. Finish loading the main session and try again.')).not.toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledTimes(2);
    expect(mockUseQuery.mock.calls.every(([options]) => options.enabled === false)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh focus tools' }));
    expect(refetch).not.toHaveBeenCalled();
  });

  it('enables queries and shows query loading for an authenticated user', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } as never, loading: false });
    mockQueries({ isLoading: true });

    render(<FocusToolsPage />);

    expect(screen.getByText('Loading focus tools...')).toBeInTheDocument();
    expect(screen.queryByText('Sign in to use Focus Tools')).not.toBeInTheDocument();
    expect(mockUseQuery.mock.calls.every(([options]) => options.enabled === true)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh focus tools' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
