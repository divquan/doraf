import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import {
  WalletBalanceCard,
  WalletSummary,
} from "@/components/wallet-balance-card"
import {
  TransactionHistoryTable,
  TransactionItem,
  PaginationMetadata,
} from "@/components/transaction-history-table"
import { AgentWithdrawal, WithdrawalPanel } from "@/components/withdrawal-panel"
import { apiJson, apiRequest } from "@/lib/agent-api"

const MAX_WALLET_TRANSACTION_PAGE = 10_000

interface AgentSession {
  agent: {
    id: string
    tenantId: string
    name: string
    phoneMask: string
    status: "ACTIVE" | "SUSPENDED"
  }
}

export default async function WalletPage({
  searchParams,
}: PageProps<"/wallet">) {
  const query = await searchParams
  const walletPage = getWalletPage(query.walletPage)

  const [sessionRes, walletSummaryRes, transactionsRes, withdrawalsRes] = await Promise.all([
    apiRequest("/agent-auth/session", {}, true),
    apiRequest("/agent-wallet/summary", {}, true),
    apiRequest(`/agent-wallet/transactions?page=${walletPage}`, {}, true),
    apiRequest("/agent-wallet/withdrawals", {}, true),
  ])

  if (sessionRes.status === 401) {
    redirect("/login")
  }

  const { agent } = (await apiJson(sessionRes)) as AgentSession
  const walletSummary = (await apiJson(walletSummaryRes)) as WalletSummary
  const transactionsData = (await apiJson(transactionsRes)) as {
    items: TransactionItem[]
    pagination: PaginationMetadata
  }
  const withdrawals = (await apiJson(withdrawalsRes)) as AgentWithdrawal[]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Wallet & Ledger"
        description="Monitor your earnings, view active holds, and track your ledger history."
      />
      <section>
        <WalletBalanceCard summary={walletSummary} />
      </section>
      <section>
        <WithdrawalPanel
          phoneMask={agent.phoneMask}
          readOnly={agent.status === "SUSPENDED"}
          withdrawableMinor={walletSummary.withdrawableMinor}
          withdrawals={withdrawals}
          transactions={transactionsData.items}
          pagination={transactionsData.pagination}
        />
      </section>
    </div>
  )
}

function getWalletPage(value: string | string[] | undefined): number {
  const page = Array.isArray(value) ? value[0] : value

  if (!page || !/^[1-9]\d*$/.test(page)) {
    return 1
  }

  const parsed = Number(page)
  if (!Number.isSafeInteger(parsed)) {
    return MAX_WALLET_TRANSACTION_PAGE
  }

  return Math.min(parsed, MAX_WALLET_TRANSACTION_PAGE)
}
