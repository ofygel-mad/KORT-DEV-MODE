// ── Chapan Order types — synced with backend schema ──────────────────────────
// Backend model: ChapanOrder, ChapanOrderItem, ChapanProductionTask, ChapanPayment, ChapanActivity

export type OrderStatus =
  | 'new' | 'confirmed' | 'in_production' | 'ready'
  | 'transferred' | 'on_warehouse' | 'shipped' | 'completed' | 'cancelled';

export type PaymentStatus = 'not_paid' | 'partial' | 'paid';

// Backend accepts: 'normal' | 'urgent' | 'vip'
export type Priority = 'normal' | 'urgent' | 'vip';

export interface ChapanOrder {
  id: string;
  orgId: string;
  orderNumber: string;
  // Backend field names:
  clientId: string;
  clientName: string;
  clientPhone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  priority: Priority;
  totalAmount: number;
  paidAmount: number;
  dueDate: string | null;          // was: deadline
  streetAddress: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations (included by backend):
  items: OrderItem[];
  productionTasks: ProductionTask[];
  payments: OrderPayment[];
  activities: OrderActivity[];
  transfer: OrderTransfer | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productName: string;
  fabric?: string;          // optional after removing fabric input from the order form
  size: string;             // was: sizeName
  quantity: number;         // was: qty
  unitPrice: number;
  notes: string | null;
  workshopNotes: string | null;
  // color is not in DB yet — will add migration
}

export interface ProductionTask {
  id: string;
  orderId: string;
  orderItemId: string;
  productName: string;
  fabric?: string;
  size: string;
  quantity: number;
  status: ProductionStatus;
  assignedTo: string | null;    // was: assignedToName
  isBlocked: boolean;           // was: flagged
  blockReason: string | null;   // was: flagReason
  defects: string | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  // From order relation:
  order: {
    id: string;
    orderNumber: string;
    priority: Priority;
    dueDate: string | null;
    clientName?: string;        // only in manager view
    clientPhone?: string;       // only in manager view
  };
}

export type ProductionStatus =
  | 'queued' | 'in_progress' | 'done';

export interface OrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  note: string | null;
  authorName: string;
  createdAt: string;
}

export interface OrderActivity {
  id: string;
  orderId: string;
  type: string;
  content: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface OrderTransfer {
  id: string;
  orderId: string;
  status: string;
  managerConfirmed: boolean;
  clientConfirmed: boolean;
  createdAt: string;
}

// ── Create/Update DTOs ────────────────────────────────────────────────────────

export interface CreateOrderDto {
  clientName: string;          // required
  clientPhone: string;         // required
  clientId?: string;           // optional: link to existing ChapanClient
  priority: Priority;
  orderDate?: string;
  dueDate?: string;            // ISO date: '2026-03-25'
  streetAddress?: string;
  postalCode?: string;
  totalAmount?: number;
  orderDiscount?: number;
  prepayment?: number;
  paymentMethod?: 'cash' | 'kaspi_qr' | 'kaspi_terminal' | 'transfer' | 'mixed';
  mixedBreakdown?: {
    mixedCash: number;
    mixedKaspiQr: number;
    mixedKaspiTerminal: number;
    mixedTransfer: number;
  };
  receiptFileNames?: string[];
  items: CreateOrderItemDto[];
  sourceRequestId?: string;
  managerNote?: string;
}

export interface CreateOrderItemDto {
  productName: string;
  fabric?: string;             // optional; backend will default when omitted
  size: string;                // was: sizeName
  quantity: number;            // was: qty (min 1)
  unitPrice: number;
  notes?: string;
  workshopNotes?: string;
}

export interface UpdateOrderDto {
  clientName?: string;
  clientPhone?: string;
  dueDate?: string | null;
  priority?: Priority;
  items?: CreateOrderItemDto[];
}

export interface AddPaymentDto {
  amount: number;
  method: string;
  note?: string;
}

// ── Settings/Catalogs ─────────────────────────────────────────────────────────

// Backend returns string[] for catalogs (not {id,name}[])
export interface ChapanCatalogs {
  productCatalog: string[];
  fabricCatalog: string[];
  sizeCatalog: string[];
  workers: string[];
}

export interface ChapanProfile {
  displayName: string | null;
  descriptor: string | null;
  orderPrefix: string | null;
  publicIntakeTitle: string | null;
  publicIntakeDescription: string | null;
  publicIntakeEnabled: boolean;
  supportLabel: string | null;
}

export interface ChapanClient {
  id: string;
  orgId: string;
  fullName: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string;
}

// ── API Response wrappers ─────────────────────────────────────────────────────

export interface ListResponse<T> {
  count: number;
  results: T[];
}

// ── Invoice (Накладная) types ────────────────────────────────────────────────

export type InvoiceStatus = 'pending_confirmation' | 'confirmed' | 'rejected';

export interface ChapanInvoice {
  id: string;
  orgId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  createdById: string;
  createdByName: string;
  seamstressConfirmed: boolean;
  seamstressConfirmedAt: string | null;
  seamstressConfirmedBy: string | null;
  warehouseConfirmed: boolean;
  warehouseConfirmedAt: string | null;
  warehouseConfirmedBy: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    invoiceId: string;
    orderId: string;
    order: ChapanOrder;
  }>;
}
