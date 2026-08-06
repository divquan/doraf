import { redirect } from "next/navigation"
import { PageHeader } from "@/components/_workspace/page-header"
import {
  AdminWithdrawal,
  WithdrawalOperations,
} from "@/components/withdrawal-operations"
import { apiJson, apiRequest } from "@/lib/internal-api"

export default async function WithdrawalsPage() {
  const response = await apiRequest("/admin/withdrawals", {}, true)

  if (response.status === 401) {
    redirect("/login")
  }
  if (response.status === 403) {
    redirect("/dashboard")
  }

  const withdrawals = (await apiJson(response)) as AdminWithdrawal[]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Withdrawals"
        description="Review held wallet funds, approve Mobile Money transfers, and reconcile Paystack outcomes."
      />
      <section>
        <WithdrawalOperations withdrawals={withdrawals} />
      </section>
    </div>
  )
}
