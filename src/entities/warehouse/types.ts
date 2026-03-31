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

// ── Smart Catalog types ────────────────────────────────────────────────────────

export type FieldInputType = 'select' | 'multiselect' | 'text' | 'number' | 'boolean';

export interface WarehouseFieldOption {
  id: string;
  definitionId: string;
  value: string;
  label: string;
  sortOrder: number;
  colorHex?: string | null;
  isActive: boolean;
}

export interface WarehouseFieldDefinition {
  id: string;
  orgId: string;
  code: string;
  label: string;
  entityScope: string;
  inputType: FieldInputType;
  isRequired: boolean;
  isVariantAxis: boolean;
  showInWarehouseForm: boolean;
  showInOrderForm: boolean;
  showInDocuments: boolean;
  affectsAvailability: boolean;
  sortOrder: number;
  isSystem: boolean;
  options: WarehouseFieldOption[];
}

export interface WarehouseProductField {
  id: string;
  productId: string;
  definitionId: string;
  isRequired: boolean;
  sortOrder: number;
  definition: WarehouseFieldDefinition;
}

export interface WarehouseProductCatalog {
  id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
  source?: string | null;
  fieldLinks: WarehouseProductField[];
}

export interface OrderFormField {
  code: string;
  label: string;
  inputType: FieldInputType;
  isRequired: boolean;
  affectsAvailability: boolean;
  options: Array<{ value: string; label: string }>;
}

export interface OrderFormProduct {
  id: string;
  name: string;
  fields: OrderFormField[];
}

export interface OrderFormCatalog {
  products: OrderFormProduct[];
}

export interface VariantAvailability {
  status: 'in_stock' | 'low' | 'out_of_stock' | 'unknown';
  variantKey: string;
  qty: number | null;
  itemId?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export function getStockStatus(item: WarehouseItem): StockStatus {
  if (item.qty <= item.qtyMin) return 'critical';
  if (item.qty <= item.qtyMin * 1.5) return 'low';
  return 'ok';
}
