import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { Clock, GitMerge, Shield, WifiOff, Sparkles } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  const features = [
    {
      icon: WifiOff,
      title: "Local-First",
      description: "IndexedDB is the source of truth. Edit offline with zero network blocking.",
    },
    {
      icon: GitMerge,
      title: "Deterministic Merge",
      description: "Vector clocks + causal ordering resolve conflicts without destroying offline work.",
    },
    {
      icon: Clock,
      title: "Time Travel",
      description: "Capture snapshots, browse a version timeline, and restore safely.",
    },
    {
      icon: Shield,
      title: "Role-Based Access",
      description: "Owner, Editor, and Viewer roles with strict sync authorization.",
    },
    {
      icon: Sparkles,
      title: "AI Assistant",
      description: "Summarize, improve, expand, and re-tone your documents inline.",
    },
  ];

  return (
    <>
      <AppHeader />
      <main>
        <section className="mx-auto max-w-5xl px-4 py-12 text-center sm:py-20">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-violet-600 sm:mb-4 sm:text-sm">
            Local-First Collaborative Editor
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            Write anywhere.
            <br />
            <span className="text-violet-600">Sync everywhere.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:mt-6 sm:text-lg dark:text-slate-400">
            Chronicle is a distributed document editor built for offline resilience,
            deterministic conflict resolution, and granular version control.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">Start writing</Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">Sign in</Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12 sm:py-20 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <f.icon className="mb-3 h-8 w-8 text-violet-600" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
