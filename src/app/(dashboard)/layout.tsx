import { SideNav } from '@/components/dashboard/side-nav'
import { DashboardChromeProvider } from '@/components/dashboard/dashboard-chrome'
import { AuthProfileProvider } from '@/components/auth/auth-profile-provider'
import { ForcePasswordChangeModal } from '@/components/auth/force-password-change-modal'
import { BusyProvider } from '@/components/ui/busy-provider'
import { ErpConfirmProvider } from '@/components/ui/erp-confirm'
import { PageLocationHeader } from '@/components/ui/page-location-header'
import { ToastProvider } from '@/components/ui/toast-provider'
import { isAuthDisabled } from '@/lib/auth/config'
import { getAuthProfile } from '@/lib/auth/session'
import { DashboardChromeShell } from '@/components/dashboard/dashboard-chrome-shell'

/** Supabase 데이터가 빌드 시점 HTML에 고정되지 않도록 매 요청마다 조회합니다. */
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const authDisabled = isAuthDisabled()
  const profile = await getAuthProfile()

  return (
    <AuthProfileProvider profile={profile} authDisabled={authDisabled}>
      <ToastProvider>
        <BusyProvider>
          <ErpConfirmProvider>
            <DashboardChromeProvider>
              <DashboardChromeShell
                sideNav={<SideNav profile={profile} authDisabled={authDisabled} />}
                pageHeader={<PageLocationHeader />}
              >
                {children}
              </DashboardChromeShell>
              <ForcePasswordChangeModal open={Boolean(profile?.mustChangePassword)} />
            </DashboardChromeProvider>
          </ErpConfirmProvider>
        </BusyProvider>
      </ToastProvider>
    </AuthProfileProvider>
  )
}
