// ── Chapan Order types — synced with backend schema ──────────────────────────
// Backend model: ChapanOrder, ChapanOrderItem, ChapanProductionTask, ChapanPayment, ChapanActivity

export type OrderStatus =
  | 'new' | 'confirmed' | 'in_production' | 'ready'
  | 'transferred' | 'completed' | 'cancelled';

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
  cancelReason: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
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
  fabric: string;           // was: fabricName
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
  fabric: string;
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
  | 'pending' | 'cutting' | 'sewing' | 'finishing' | 'quality_check' | 'done';

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
  dueDate?: string;            // ISO date: '2026-03-25'
  items: CreateOrderItemDto[];
  sourceRequestId?: string;
}

export interface CreateOrderItemDto {
  productName: string;
  fabric: string;              // was: fabricName
  size: string;                // was: sizeName
  quantity: number;            // was: qty (min 1)
  unitPrice: number;
  notes?: string;
  workshopNotes?: string;
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
