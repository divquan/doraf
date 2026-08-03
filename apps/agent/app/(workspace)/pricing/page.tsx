import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import { AgentPricingRow, PricingGrid } from "@/components/pricing-grid"
import { apiJson, apiRequest } from "@/lib/agent-api"

interface AgentSession {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

export default async function PricingPage() {
  const [sessionRes, pricesRes] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-auth/prices", {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const prices = (await apiJson(pricesRes)) as AgentPricingRow[]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Pricing Setup"
        description="Configure custom retail pricing for each exam checker. Profit margins are credited directly to your wallet."
      />
      <section>
        <PricingGrid
          rows={prices}
          readOnly={agent.status === "SUSPENDED"}
        />
      </section>
    </div>
  )
}
