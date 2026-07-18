import { redirect } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { TopNav } from "@/components/dashboard/top-nav";
import { getMeServer } from "@/lib/api/me-server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate the dashboard on a valid paperboat-server session (the server is the
  // trust root). No session → send to /login. Read-only; the session is issued
  // and rotated by the server via the BFF, never written here.
  const me = await getMeServer();
  if (!me) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <TopNav
          user={{
            email: me.email,
            firstName: me.display_name || null,
            lastName: null,
            profilePictureUrl: null,
          }}
        />
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
