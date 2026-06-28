import Link from "next/link";
import { auth, signOut } from "@/lib/auth/config";
import { Button } from "@/components/ui/button";
import { FileText, LogOut, LayoutDashboard } from "lucide-react";

export async function AppHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-4">
        <Link href={session ? "/dashboard" : "/"} className="flex min-w-0 items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
            <FileText className="h-4 w-4" />
          </div>
          <span className="truncate">Chronicle</span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-3">
          {session ? (
            <>
              <span className="hidden max-w-[140px] truncate text-sm text-slate-500 md:inline lg:max-w-xs">
                {session.user?.email}
              </span>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3" aria-label="Dashboard">
                  <LayoutDashboard className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="ghost" size="icon" type="submit" aria-label="Sign out" className="h-9 w-9">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="px-2 sm:px-4">
                  <span className="sm:hidden">Start</span>
                  <span className="hidden sm:inline">Get started</span>
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
