import { ProductInventoryWorkspace } from '@/components/inventory/product-inventory-workspace'
import { PageShell } from '@/components/ui/page-shell'
import { fetchProductStockRows } from '@/lib/inventory/product-stock'

export default async function ProductInventoryPage() {
  const result = await fetchProductStockRows()
  return (
    <PageShell>
      <ProductInventoryWorkspace result={result} />
    </PageShell>
  )
}
