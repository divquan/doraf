import { redirect } from "next/navigation"
import { AgentManagement } from "@/components/agent-management"
import { InviteInternalUserForm } from "@/components/invite-internal-user-form"
import { LogoutButton } from "@/components/logout-button"
import { ManualInventoryForm } from "@/components/manual-inventory-form"
import {
  InventoryOverview,
  type InventoryOverviewData,
} from "@/components/inventory-overview"
import { PricingControls } from "@/components/pricing-controls"
import { ProductAvailability } from "@/components/product-availability"
import { apiJson, apiRequest } from "@/lib/internal-api"

export default async function DashboardPage() {
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
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-10 p-6 md:p-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Doraf Administration
          </p>
          <h1 className="font-heading text-4xl">Operations workspace</h1>
        </div>
        <LogoutButton />
      </header>
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Inventory operations</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Monitor authoritative stock counts and review securely masked batch
            history.
          </p>
        </div>
        <InventoryOverview data={inventory} />
        {pricing.viewerRole === "ADMINISTRATOR" ? (
          <ManualInventoryForm products={pricing.products} />
        ) : null}
      </section>
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Pricing operations</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Configure effective product ranges and targeted agent exceptions.
            Every change is audited.
          </p>
        </div>
        <PricingControls data={pricing} />
        {pricing.viewerRole === "ADMINISTRATOR" ? (
          <ProductAvailability
            products={
              pricing.products as Parameters<
                typeof ProductAvailability
              >[0]["products"]
            }
          />
        ) : null}
      </section>
      {pricing.viewerRole === "ADMINISTRATOR" ? (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Agent management</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Control whether an agent can accept new sales while preserving
              their account and historical access.
            </p>
          </div>
          <AgentManagement
            agents={
              pricing.agents as Parameters<typeof AgentManagement>[0]["agents"]
            }
          />
        </section>
      ) : null}
      <section className="flex flex-col gap-3 rounded-lg border p-6">
        <h2 className="text-xl font-semibold">Invite an internal operator</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Only Administrators can issue enrollment tokens. The token is shown
          once and must be transferred through an approved secure channel.
        </p>
        <InviteInternalUserForm />
      </section>
    </main>
  )
}
