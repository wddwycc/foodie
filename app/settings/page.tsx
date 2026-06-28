"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSettings, saveSettings, type Settings } from "../settings";

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);

  // Go back to the map, preserving its selection (kept in the URL query). A
  // plain <Link href="/"> would drop ?set=/?pref=; history.back() returns to
  // the exact previous URL. Fall back to "/" if opened directly (no history).
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  // localStorage is client-only; read after mount to avoid hydration mismatch.
  useEffect(() => {
    const load = () => setSettings(loadSettings());
    load();
  }, []);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  return (
    <main className="mx-auto w-full max-w-md p-4">
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={goBack}
          aria-label="戻る"
          className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          設定
        </h1>
      </header>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <label className="flex cursor-pointer items-center gap-3 p-4">
          <input
            type="checkbox"
            className="h-5 w-5 accent-rose-600"
            checked={settings?.hideClosedToday ?? false}
            disabled={!settings}
            onChange={(e) => update({ hideClosedToday: e.target.checked })}
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              今日定休の店を非表示
            </span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              本日が定休日のお店を地図から隠します（不定休・祝日は対象外）。
            </span>
          </span>
        </label>
      </section>
    </main>
  );
}
