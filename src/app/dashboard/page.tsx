import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <>
      <AppHeader />
      <DashboardClient />
    </>
  );
}
