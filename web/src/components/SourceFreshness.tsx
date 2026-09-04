import Link from "next/link";
import { formatSnapshotDate, SOURCE_DETAILS } from "@/lib/freshness";

export default function SourceFreshness({
  generatedAt,
  coverage,
  compact = false,
}: {
  generatedAt?: string | null;
  coverage?: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <section
      className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.03] p-4 sm:p-5"
      aria-label="Atualização das fontes"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-100">
            De quando são estes dados?
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Versão dos dados gerada em {formatSnapshotDate(generatedAt)}. Cada
            fonte tem seu próprio período de cobertura.
          </p>
        </div>
        {compact && (
          <Link
            href="/dados#atualizacao"
            className="text-sm text-emerald-300 hover:underline"
          >
            Ver fontes e datas →
          </Link>
        )}
      </div>
      {compact ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">
          {["tse", "receita"]
            .filter((key) => coverage?.[key])
            .map((key) => `${SOURCE_DETAILS[key].name}: ${coverage![key]}`)
            .join(" · ")}{" "}
          A data desta versão não significa que todas as fontes foram
          atualizadas nesse dia.
        </p>
      ) : (
        <>
          <dl className="mt-4 divide-y divide-white/5">
            {Object.entries(coverage ?? {}).map(([key, description]) => (
              <div
                key={key}
                className="grid gap-1 py-3 sm:grid-cols-[210px_1fr] sm:gap-5"
              >
                <dt className="text-sm font-medium text-zinc-200">
                  {SOURCE_DETAILS[key] ? (
                    <a
                      href={SOURCE_DETAILS[key].url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-emerald-300 hover:underline"
                    >
                      {SOURCE_DETAILS[key].name} ↗
                    </a>
                  ) : (
                    key
                  )}
                </dt>
                <dd className="text-sm leading-relaxed text-zinc-400">
                  {description === "ano configurado no build"
                    ? "Ano de referência não informado nesta versão."
                    : description || "Período não informado"}
                </dd>
              </div>
            ))}
          </dl>
          {!Object.keys(coverage ?? {}).length && (
            <p className="mt-3 text-sm text-zinc-400">
              Períodos de cobertura não informados nesta versão.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Coleta é a consulta ou download da fonte. Período de referência é a
            época retratada no registro. Gerar uma nova versão do site não
            atualiza esses registros. Dados históricos não afirmam a situação
            atual.
          </p>
        </>
      )}
    </section>
  );
}
