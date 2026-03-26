import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChapanOrder } from '../../../../entities/order/types';
import ChapanOrdersPage from './ChapanOrders';

const navigateMock = vi.fn();
const useOrdersMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../../entities/order/queries', () => ({
  useOrders: (params: unknown) => useOrdersMock(params),
}));

vi.mock('../../../../entities/warehouse/queries', () => ({
  useProductsAvailability: () => ({ data: undefined }),
}));

function buildOrder(): ChapanOrder {
  return {
    id: 'order-1',
    orgId: 'org-1',
    orderNumber: 'K-001',
    clientId: 'client-1',
    clientName: 'Тестовый клиент',
    clientPhone: '+77015554433',
    status: 'new',
    paymentStatus: 'not_paid',
    priority: 'normal',
    totalAmount: 120000,
    paidAmount: 0,
    dueDate: null,
    streetAddress: null,
    cancelReason: null,
    completedAt: null,
    cancelledAt: null,
    isArchived: false,
    archivedAt: null,
    createdAt: '2026-03-23T00:00:00.000Z',
    updatedAt: '2026-03-23T00:00:00.000Z',
    items: [],
    productionTasks: [],
    payments: [],
    activities: [],
    transfer: null,
  };
}

describe('ChapanOrdersPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useOrdersMock.mockReset();
  });

  it('shows only the centered create action when the list is truly empty', () => {
    useOrdersMock.mockReturnValue({
      data: { count: 0, results: [] },
      isLoading: false,
      isError: false,
    });

    render(<ChapanOrdersPage />);

    expect(screen.queryByRole('button', { name: /Новый заказ/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать заказ/i })).toBeInTheDocument();
  });

  it('keeps the top create button available when filtering an empty list', async () => {
    useOrdersMock.mockReturnValue({
      data: { count: 0, results: [] },
      isLoading: false,
      isError: false,
    });

    const user = userEvent.setup();
    render(<ChapanOrdersPage />);

    await user.type(screen.getByPlaceholderText(/Номер, клиент, модель/i), '123');

    expect(screen.getByRole('button', { name: /Новый заказ/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Создать заказ$/i })).not.toBeInTheDocument();
  });

  it('shows the top create button once orders already exist', () => {
    useOrdersMock.mockReturnValue({
      data: { count: 1, results: [buildOrder()] },
      isLoading: false,
      isError: false,
    });

    render(<ChapanOrdersPage />);

    expect(screen.getByRole('button', { name: /Новый заказ/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Создать заказ/i })).not.toBeInTheDocument();
  });
});
