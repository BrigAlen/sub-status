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
        "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
        (pathname === href || (href !== "/" && pathname.startsWith(href))
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800")
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">Статус подписок</span>
          <nav className="ml-4 flex flex-wrap gap-1">
            {link("/", "Обзор")}
            {link("/subscriptions", "Подписки")}
            {link("/settings", "Настройки")}
          </nav>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Выйти
        </button>
      </div>
    </header>
  );
}
