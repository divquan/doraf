import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import {
  EarningsBalanceCard,
  EarningsSummary,
} from "@/components/earnings-balance-card"
import {
  TransactionHistoryTable,
  TransactionItem,
  PaginationMetadata,
} from "@/components/transaction-history-table"
import { AgentPayout, PayoutPanel } from "@/components/payout-panel"
import { PayoutDestinationData } from "@/components/_workspace/payout-destination-form"
import { apiJson, apiRequest } from "@/lib/agent-api"

const MAX_EARNINGS_TRANSACTION_PAGE = 10_000

interface AgentSession {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

export default async function EarningsPage({
  searchParams,
}: PageProps<"/earnings">) {
  const query = await searchParams
  const earningsPage = getEarningsPage(query.earningsPage)

  const [
    sessionRes,
    walletSummaryRes,
    transactionsRes,
    withdrawalsRes,
    destinationRes,
  ] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-wallet/summary", {}, true),
    apiRequest(`/agent-wallet/transactions?page=${earningsPage}`, {}, true),
    apiRequest("/agent-wallet/withdrawals", {}, true),
    apiRequest("/agent-wallet/payout-destination", {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const earningsSummary = (await apiJson(walletSummaryRes)) as EarningsSummary
  const transactionsData = (await apiJson(transactionsRes)) as {
    items: TransactionItem[]
    pagination: PaginationMetadata
  }
  const payouts = (await apiJson(withdrawalsRes)) as AgentPayout[]
  const destination = (await apiJson(destinationRes)) as PayoutDestinationData | null

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Earnings & Ledger"
        description="Monitor your sales commissions, view pending payouts, and track your ledger history."
      />
      <section>
        <PayoutPanel
          phoneMask={agent.phoneMask}
          destination={destination}
          readOnly={agent.status === "SUSPENDED"}
          withdrawableMinor={earningsSummary.withdrawableMinor}
          earningsSummary={earningsSummary}
          payouts={payouts}
          transactions={transactionsData.items}
          pagination={transactionsData.pagination}
        />
      </section>
    </div>
  )
}

function getEarningsPage(value: string | string[] | undefined): number {
  const page = Array.isArray(value) ? value[0] : value

  if (!page || !/^[1-9]\d*$/.test(page)) {
    return 1
  }

  const parsed = Number(page)
  if (!Number.isSafeInteger(parsed)) {
    return MAX_EARNINGS_TRANSACTION_PAGE
  }

  return Math.min(parsed, MAX_EARNINGS_TRANSACTION_PAGE)
}
