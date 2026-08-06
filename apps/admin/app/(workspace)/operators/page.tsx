import { PageHeader } from "@/components/_workspace/page-header"
import { InviteInternalUserForm } from "@/components/invite-internal-user-form"

export default async function OperatorsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Operators"
        description="Only Administrators can issue enrollment tokens. The token is shown once and must be transferred through an approved secure channel."
      />
      <section>
        <InviteInternalUserForm />
      </section>
    </div>
  )
}
