import type {
  CreateSupplierInput,
  Supplier,
  UpdateSupplierInput,
} from '@claudeshop/contracts/erp';

export interface SupplierRepository {
  findById(tenantId: string, id: string): Promise<Supplier | null>;
  findByName(tenantId: string, name: string): Promise<Supplier | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number; isActive?: boolean },
  ): Promise<{ items: Supplier[]; total: number }>;
  create(tenantId: string, input: CreateSupplierInput): Promise<Supplier>;
  update(tenantId: string, id: string, input: UpdateSupplierInput): Promise<Supplier>;
  delete(tenantId: string, id: string): Promise<void>;
}
