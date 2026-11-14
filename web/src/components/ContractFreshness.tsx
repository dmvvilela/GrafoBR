import Link from "next/link";
import {
  contractObservedAt,
  type ContractRefresh,
} from "@/lib/state-contracts";
export default function ContractFreshness({
  fetchedAt,
  refresh,
}: {
  fetchedAt: string;
  refresh?: ContractRefresh;
}) {
  return (
    <aside className="my-5 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-relaxed text-zinc-400">
      <p>
        <span className="text-emerald-200">
          Última consulta completa ao PNCP: {contractObservedAt(fetchedAt)}.
        </span>{" "}
        Todos os dias do recorte são conferidos novamente.
      </p>
      {refresh && refresh.status !== "success" && (
        <p className="mt-2 text-amber-200">
          {refresh.status === "failed"
            ? "A última tentativa falhou. Mantivemos os dados da última consulta completa."
            : "Uma nova consulta foi iniciada, mas sua conclusão ainda não está publicada. Os dados abaixo são da última consulta completa."}{" "}
          Tentativa: {contractObservedAt(refresh.attemptedAt)}.
        </p>
      )}
      <p className="mt-2">
        Atualizações são publicadas após validação. Não há consulta ao vivo nem
        alertas por e-mail.
      </p>
      <Link
        href="/contratos/historico"
        className="mt-2 inline-block py-2 text-emerald-300"
      >
        O que mudou nos contratos →
      </Link>
    </aside>
  );
}
