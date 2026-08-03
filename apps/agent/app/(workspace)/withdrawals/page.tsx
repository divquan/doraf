import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import { AgentWithdrawal, WithdrawalPanel } from "@/components/withdrawal-panel"
import { WalletSummary } from "@/components/wallet-balance-card"
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

export default async function WithdrawalsPage() {
  const [sessionRes, walletSummaryRes, withdrawalsRes] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-wallet/summary", {}, true),
    apiRequest("/agent-wallet/withdrawals", {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const walletSummary = (await apiJson(walletSummaryRes)) as WalletSummary
  const withdrawals = (await apiJson(withdrawalsRes)) as AgentWithdrawal[]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Withdrawals"
        description="Request payouts to your Mobile Money account and track past request statuses."
      />
      <section>
        <WithdrawalPanel
          phoneMask={agent.phoneMask}
          readOnly={agent.status === "SUSPENDED"}
          withdrawableMinor={walletSummary.withdrawableMinor}
          withdrawals={withdrawals}
        />
      </section>
    </div>
  )
}
