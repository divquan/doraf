import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import { PricingControls } from "@/components/pricing-controls"
import { ProductAvailability } from "@/components/product-availability"
import { apiJson, apiRequest } from "@/lib/internal-api"

export default async function PricingPage() {
  const pricingResponse = await apiRequest("/admin/products/pricing", {}, true)

  if (pricingResponse.status === 401) {
    redirect("/login")
  }

  const pricing = (await apiJson(pricingResponse)) as Parameters<
    typeof PricingControls
  >[0]["data"]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Pricing"
        description="Configure effective product ranges and targeted agent exceptions. Every change is audited."
      />
      <section>
        <PricingControls data={pricing} />
      </section>
      {pricing.viewerRole === "ADMINISTRATOR" ? (
        <section>
          <ProductAvailability
            products={
              pricing.products as Parameters<
                typeof ProductAvailability
              >[0]["products"]
            }
          />
        </section>
      ) : null}
    </div>
  )
}
