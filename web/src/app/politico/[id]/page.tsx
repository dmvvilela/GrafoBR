// STUB (Phase 4) — one statically-generated page per federal politician.
//
// This is where SEO comes from: each politician gets a pre-rendered HTML page so a
// citizen Googling their name lands here. The interactive graph hydrates client-side.
//
// TODO (Phase 4):
//   1. generateStaticParams(): read the politician index (e.g. data/index.json) and
//      return [{ id: "1" }, { id: "2" }, ...] for all ~594 politicians.
//   2. Load that politician's ego-network JSON (data/<id>.json) at build time.
//   3. Render: header (name, party, office), the <NetworkGraph> (client island),
//      a profile panel, source attribution, and the disclaimer (see docs/LEGAL.md).
//   4. When all pages are SSG, enable `output: "export"` in next.config.mjs.
//
// Example skeleton (uncomment + wire to real data once the pipeline emits files):
//
// import NetworkGraph from "@/components/NetworkGraph";
// import type { EgoNetwork } from "@/lib/contract";
//
// export async function generateStaticParams() {
//   const index = await loadIndex();            // from data/index.json
//   return index.map((p) => ({ id: String(p.id) }));
// }
//
// export default async function PoliticoPage({ params }: { params: { id: string } }) {
//   const data: EgoNetwork = await loadEgoNetwork(params.id);
//   return (
//     <main>
//       <h1 className="text-2xl font-bold">{data.meta?.egoName}</h1>
//       <NetworkGraph data={data} />
//     </main>
//   );
// }

export default function PoliticoPageStub() {
  return (
    <main>
      <h1 className="text-xl font-bold">Página de político (stub)</h1>
      <p className="mt-2 text-sm text-gray-600">
        Phase 4: SSG por político. Veja os comentários neste arquivo e docs/PLAN.md.
      </p>
    </main>
  );
}
