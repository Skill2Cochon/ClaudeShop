import { z } from 'zod';
import {
  CuidSchema,
  CurrencyCodeSchema,
  IsoDateTimeSchema,
  MoneySchema,
} from '../common/primitives';

// --- Suppliers ------------------------------------------------------------

export const SupplierSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  name: z.string().min(1).max(200),
  contactEmail: z.string().email().nullable(),
  phone: z.string().nullable(),
  currency: CurrencyCodeSchema,
  paymentTermsDays: z.number().int().min(0).max(365),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const CreateSupplierInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactEmail: z.string().email().optional(),
  phone: z.string().trim().min(1).max(40).optional(),
  currency: CurrencyCodeSchema,
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});
export type CreateSupplierInput = z.infer<typeof CreateSupplierInputSchema>;

export const UpdateSupplierInputSchema = CreateSupplierInputSchema.partial();
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierInputSchema>;

// --- Purchase orders ------------------------------------------------------

export const PurchaseOrderStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'PARTIAL',
  'RECEIVED',
  'CANCELLED',
]);
export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusSchema>;

export const PurchaseOrderLineSchema = z.object({
  id: CuidSchema,
  purchaseOrderId: CuidSchema,
  variantId: CuidSchema,
  sku: z.string(),
  qtyOrdered: z.number().int().positive(),
  qtyReceived: z.number().int().min(0),
  unitCost: MoneySchema,
  subtotal: MoneySchema,
});
export type PurchaseOrderLine = z.infer<typeof PurchaseOrderLineSchema>;

export const PurchaseOrderSchema = z.object({
  id: CuidSchema,
  tenantId: CuidSchema,
  supplierId: CuidSchema,
  number: z.string(),
  status: PurchaseOrderStatusSchema,
  currency: CurrencyCodeSchema,
  subtotal: MoneySchema,
  shipping: MoneySchema,
  tax: MoneySchema,
  total: MoneySchema,
  expectedAt: IsoDateTimeSchema.nullable(),
  placedAt: IsoDateTimeSchema.nullable(),
  receivedAt: IsoDateTimeSchema.nullable(),
  notes: z.string().nullable(),
  lines: z.array(PurchaseOrderLineSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;

export const CreatePurchaseOrderLineInputSchema = z.object({
  variantId: CuidSchema,
  sku: z.string().min(1),
  qtyOrdered: z.number().int().positive(),
  unitCost: MoneySchema,
});
export type CreatePurchaseOrderLineInput = z.infer<
  typeof CreatePurchaseOrderLineInputSchema
>;

export const CreatePurchaseOrderInputSchema = z.object({
  supplierId: CuidSchema,
  currency: CurrencyCodeSchema,
  expectedAt: IsoDateTimeSchema.optional(),
  shipping: MoneySchema.optional(),
  tax: MoneySchema.optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(CreatePurchaseOrderLineInputSchema).min(1).max(500),
});
export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderInputSchema>;

export const ReceivePurchaseOrderLineInputSchema = z.object({
  lineId: CuidSchema,
  /** Additional quantity received on this receive event (incremental). */
  qty: z.number().int().positive(),
});
export type ReceivePurchaseOrderLineInput = z.infer<
  typeof ReceivePurchaseOrderLineInputSchema
>;

export const ReceivePurchaseOrderInputSchema = z.object({
  lines: z.array(ReceivePurchaseOrderLineInputSchema).min(1),
});
export type ReceivePurchaseOrderInput = z.infer<typeof ReceivePurchaseOrderInputSchema>;
