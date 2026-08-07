import { AuthPageShell } from "@/components/_auth/auth-page-shell"

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthPageShell>{children}</AuthPageShell>
}
