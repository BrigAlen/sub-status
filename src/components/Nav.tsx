"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiMutate } from "@/lib/client-csrf";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/login") return null;

  async function logout() {
    await apiMutate("/api/auth/logout", "POST");
    router.push("/login");
    router.refresh();
  }

  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={
        "inline-flex min-h-11 min-w-[4.5rem] flex-1 items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium transition sm:min-h-0 sm:min-w-0 sm:flex-none sm:py-1.5 " +
        (pathname === href || (href !== "/" && pathname.startsWith(href))
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800")
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-lg font-semibold tracking-tight">
            Статус подписок
          </span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 sm:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Выйти
          </button>
        </div>
        <div className="flex items-stretch gap-2 sm:items-center">
          <nav className="flex min-w-0 flex-1 gap-1">
            {link("/", "Обзор")}
            {link("/subscriptions", "Подписки")}
            {link("/settings", "Настройки")}
          </nav>
          <button
            type="button"
            onClick={logout}
            className="hidden min-h-11 shrink-0 items-center rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 sm:inline-flex sm:min-h-0 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
