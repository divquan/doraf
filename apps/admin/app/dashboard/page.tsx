import { redirect } from "next/navigation"
import { InviteInternalUserForm } from "@/components/invite-internal-user-form"
import { LogoutButton } from "@/components/logout-button"
import { PricingControls } from "@/components/pricing-controls"
import { apiJson, apiRequest } from "@/lib/internal-api"

export default async function DashboardPage() {
  const response = await apiRequest("/admin/products/pricing", {}, true)
  if (response.status === 401) redirect("/login")
  const pricing = await apiJson(response)
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
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Pricing operations</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Configure effective product ranges and targeted agent exceptions.
            Every change is audited.
          </p>
        </div>
        <PricingControls
          data={pricing as Parameters<typeof PricingControls>[0]["data"]}
        />
      </section>
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
