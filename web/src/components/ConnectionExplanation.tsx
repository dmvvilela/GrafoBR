import type { EgoNetwork, GraphLink } from "@/lib/contract";
import { explainConnection } from "@/lib/profile-analysis";

export default function ConnectionExplanation({
  ego,
  link,
  compact = false,
}: {
  ego: EgoNetwork;
  link: GraphLink;
  compact?: boolean;
}) {
  const explanation = explainConnection(link, ego);
  return (
    <div className={compact ? "space-y-1.5" : "rounded-xl bg-white/[0.02] p-3"}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {explanation.chain.map((part, index) => (
          <span key={`${part}-${index}`} className={index % 2 === 0 ? "text-zinc-300" : "text-zinc-600"}>
            {part}
          </span>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-600">
        {explanation.reading}
      </p>
      <p className="text-[11px] text-zinc-600">
        Fonte:{" "}
        {explanation.sourceUrl ? (
          <a
            href={explanation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 hover:underline"
          >
            {explanation.source}
          </a>
        ) : (
          <span>{explanation.source}</span>
        )}
      </p>
    </div>
  );
}
