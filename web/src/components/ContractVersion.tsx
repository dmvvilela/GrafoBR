"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
function Notice({ version }: { version: string }) {
  const requested = useSearchParams().get("v");
  return requested && requested !== version ? (
    <p className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-100">
      Este link foi compartilhado em outra versão. Os valores exibidos são da
      atualização atual; o card antigo pode conter valores diferentes.
    </p>
  ) : null;
}
export default function ContractVersion({ version }: { version: string }) {
  return (
    <Suspense>
      <Notice version={version} />
    </Suspense>
  );
}
