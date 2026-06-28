import Link from "next/link";
import { Github, Linkedin } from "lucide-react";

const AUTHOR = {
  name: "Anshu Kumar Bishwas",
  github: "https://github.com/Anshu331",
  linkedin: "https://linkedin.com/in/anshu-kumar-bishwas-792801207/",
};

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-3 py-2.5 text-center text-xs text-slate-500 sm:flex-row sm:gap-4 sm:px-4 sm:text-left sm:text-sm">
        <p>
          Built by{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">{AUTHOR.name}</span>
        </p>
        <nav className="flex items-center gap-4" aria-label="Author profiles">
          <Link
            href={AUTHOR.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
          >
            <Github className="h-4 w-4" aria-hidden />
            <span>GitHub</span>
          </Link>
          <Link
            href={AUTHOR.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
          >
            <Linkedin className="h-4 w-4" aria-hidden />
            <span>LinkedIn</span>
          </Link>
        </nav>
      </div>
    </footer>
  );
}
