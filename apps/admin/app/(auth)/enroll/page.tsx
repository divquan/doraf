import { PasskeyEnrollmentForm } from "@/components/passkey-enrollment-form"

export default function EnrollPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Dashchecker Administration
        </p>
        <h1 className="font-heading text-4xl">Set up your passkey</h1>
        <p className="text-muted-foreground">
          Your enrollment token is short-lived and can only be used once.
        </p>
      </div>
      <PasskeyEnrollmentForm />
    </div>
  )
}
