import { redirect } from "next/navigation"
import { AgentManagement } from "@/components/agent-management"
import { PageHeader } from "@/components/_workspace/page-header"
import { PricingControls } from "@/components/pricing-controls"
import { apiJson, apiRequest } from "@/lib/internal-api"

export default async function AgentsPage() {
  const pricingResponse = await apiRequest("/admin/products/pricing", {}, true)

  if (pricingResponse.status === 401) {
    redirect("/login")
  }
  if (pricingResponse.status === 403) {
    redirect("/dashboard")
  }

  const pricing = (await apiJson(pricingResponse)) as Parameters<
    typeof PricingControls
  >[0]["data"]

  if (pricing.viewerRole !== "ADMINISTRATOR") {
    redirect("/dashboard")
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Agents"
        description="Control whether an agent can accept new sales while preserving their account and historical access."
      />
      <section>
        <AgentManagement
          agents={
            pricing.agents as Parameters<typeof AgentManagement>[0]["agents"]
          }
        />
      </section>
    </div>
  )
}
