import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import {
  InventoryOverview,
  type InventoryOverviewData,
} from "@/components/inventory-overview"
import { ManualInventoryForm } from "@/components/manual-inventory-form"
import { PricingControls } from "@/components/pricing-controls"
import { apiJson, apiRequest } from "@/lib/internal-api"

export default async function InventoryPage() {
  const [pricingResponse, inventoryResponse] = await Promise.all([
    apiRequest("/admin/products/pricing", {}, true),
    apiRequest("/admin/inventory", {}, true),
  ])

  if (pricingResponse.status === 401 || inventoryResponse.status === 401) {
    redirect("/login")
  }

  const pricing = (await apiJson(pricingResponse)) as Parameters<
    typeof PricingControls
  >[0]["data"]
  const inventory = (await apiJson(inventoryResponse)) as InventoryOverviewData

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Inventory"
        description="Monitor authoritative stock counts and review securely masked batch history."
      />
      <section>
        <InventoryOverview data={inventory} />
      </section>
      {pricing.viewerRole === "ADMINISTRATOR" ? (
        <section>
          <ManualInventoryForm products={pricing.products} />
        </section>
      ) : null}
    </div>
  )
}
