"use client";
import { useEffect, useState } from "react";
import { FOLLOW_KEY, parseFollows, type Follow } from "@/lib/contract-history";
export function useFollowing() {
  const [items, setItems] = useState<Follow[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    function read() {
      try {
        setItems(parseFollows(localStorage.getItem(FOLLOW_KEY)));
        setError("");
        setReady(true);
      } catch {
        setReady(false);
        setError(
          "Não foi possível ler suas escolhas neste navegador. Verifique o armazenamento local.",
        );
      }
    }
    read();
    window.addEventListener("storage", read);
    window.addEventListener("grafobr-follow", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("grafobr-follow", read);
    };
  }, []);
  function update(change: (current: Follow[]) => Follow[]) {
    try {
      const next = change(parseFollows(localStorage.getItem(FOLLOW_KEY)));
      const raw = JSON.stringify({ version: 1, items: next });
      parseFollows(raw);
      localStorage.setItem(FOLLOW_KEY, raw);
      window.dispatchEvent(new Event("grafobr-follow"));
      setError("");
    } catch {
      setError(
        "Não foi possível salvar. Suas escolhas anteriores foram mantidas; permita armazenamento local e tente novamente.",
      );
    }
  }
  return { items, ready, error, update };
}
export default function FollowButton({
  target,
  name,
  sequence,
  baseline,
}: {
  target: string;
  name: string;
  sequence: number;
  baseline: string;
}) {
  const { items, ready, error, update } = useFollowing();
  const following = items.some((f) => f.key === target);
  return (
    <div className="my-4">
      <button
        disabled={!ready}
        aria-pressed={following}
        onClick={() =>
          update((current) =>
            current.some((f) => f.key === target)
              ? current.filter((f) => f.key !== target)
              : [...current, { key: target, name, seen: sequence, baseline }],
          )
        }
        className="min-h-11 rounded-xl border border-emerald-300/30 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-200 disabled:opacity-50"
      >
        {following ? "✓ Acompanhando · deixar de seguir" : "＋ Acompanhar"}
      </button>
      <p role="status" className="mt-2 text-xs text-zinc-400">
        {error ||
          "Suas escolhas ficam neste navegador. Veja novidades em Acompanhando."}
      </p>
    </div>
  );
}
