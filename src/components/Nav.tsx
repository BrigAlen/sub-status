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
        "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-2.5 text-sm font-medium transition sm:min-h-0 sm:flex-none sm:px-3 sm:py-1.5 " +
        (pathname === href || (href !== "/" && pathname.startsWith(href))
          ? "bg-violet-600 text-white shadow-sm shadow-violet-900/40"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100")
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 w-full max-w-full min-w-0 overflow-x-hidden border-b border-zinc-800/80 bg-[#0a0a0a]/90 backdrop-blur pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <div className="mx-auto flex min-w-0 w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display truncate text-lg font-semibold tracking-tight">
            Статус подписок
          </span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 sm:hidden"
          >
            Выход
          </button>
        </div>
        <div className="flex min-w-0 items-stretch gap-2 sm:items-center">
          <nav className="flex min-w-0 flex-1 gap-1">
            {link("/", "Обзор")}
            {link("/subscriptions", "Подписки")}
            {link("/settings", "Настройки")}
          </nav>
          <button
            type="button"
            onClick={logout}
            className="hidden min-h-11 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 sm:inline-flex sm:min-h-0"
          >
            Выход
          </button>
        </div>
      </div>
    </header>
  );
}
