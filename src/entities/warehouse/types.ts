// Backend: /api/v1/warehouse/*

export interface WarehouseCategory {
  id: string;
  name: string;
  color?: string;
}

export interface WarehouseItem {
  id: string;
  orgId: string;
  name: string;
  sku?: string | null;
  unit: string;
  qty: number;
  qtyMin: number;
  qtyMax?: number | null;
  costPrice?: number | null;
  categoryId?: string | null;
  category?: WarehouseCategory | null;
  tags: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = 'in' | 'out' | 'adjustment' | 'write_off' | 'return';

export interface WarehouseMovement {
  id: string;
  orgId: string;
  itemId: string;
  item?: Pick<WarehouseItem, 'id' | 'name' | 'unit'>;
  type: MovementType;
  qty: number;
  reason?: string | null;
  author: string;
  createdAt: string;
}

export interface WarehouseAlert {
  id: string;
  orgId: string;
  itemId: string;
  item?: Pick<WarehouseItem, 'id' | 'name' | 'unit' | 'qty' | 'qtyMin'>;
  type: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface WarehouseSummary {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  categories: number;
}

export interface PaginatedWarehouseItems {
  count: number;
  page: number;
  totalPages: number;
  results: WarehouseItem[];
}

export interface PaginatedMovements {
  count: number;
  page: number;
  totalPages: number;
  results: WarehouseMovement[];
}

export interface CreateItemDto {
  name: string;
  sku?: string;
  unit?: string;
  qty?: number;
  qtyMin?: number;
  costPrice?: number;
  categoryId?: string;
  notes?: string;
}

export interface AddMovementDto {
  itemId: string;
  type: MovementType;
  qty: number;
  reason?: string;
}

export type StockStatus = 'ok' | 'low' | 'critical';

export interface ProductStockInfo {
  available: boolean;
  qty: number;
  itemName: string | null;
}

export type ProductsAvailabilityMap = Record<string, ProductStockInfo>;

export function getStockStatus(item: WarehouseItem): StockStatus {
  if (item.qty <= item.qtyMin) return 'critical';
  if (item.qty <= item.qtyMin * 1.5) return 'low';
  return 'ok';
}
