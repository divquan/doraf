import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import { InventoryImportDialog } from "@/components/inventory-import-dialog"
import {
  InventoryOverview,
  type InventoryOverviewData,
} from "@/components/inventory-overview"
import { apiJson, apiRequest } from "@/lib/internal-api"
import type { AdminPricingData } from "@/lib/pricing"

export default async function InventoryPage() {
  const [pricingResponse, inventoryResponse] = await Promise.all([
    apiRequest("/admin/products/pricing", {}, true),
    apiRequest("/admin/inventory", {}, true),
  ])

  if (pricingResponse.status === 401 || inventoryResponse.status === 401) {
    redirect("/login")
  }

  const pricing = (await apiJson(pricingResponse)) as AdminPricingData
  const inventory = (await apiJson(inventoryResponse)) as InventoryOverviewData

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Inventory"
        description="Monitor authoritative stock counts, configure checker pricing, and review securely masked batch history."
        actions={
          pricing.viewerRole === "ADMINISTRATOR" ? (
            <InventoryImportDialog products={pricing.products} />
          ) : undefined
        }
      />
      <section>
        <InventoryOverview
          data={inventory}
          pricingProducts={pricing.products}
          viewerRole={pricing.viewerRole}
        />
      </section>
    </div>
  )
}
