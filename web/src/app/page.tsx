import { getIndex } from "@/lib/data";
import SearchDirectory from "@/components/SearchDirectory";

export default async function Home() {
  const index = await getIndex();

  return (
    <div className="space-y-12">
      <section className="pt-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {index.length} {index.length === 1 ? "parlamentar" : "parlamentares"} ·
          dados públicos
        </div>

        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          <span className="gradient-text">Siga as conexões</span> por trás de cada
          deputado.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-zinc-400">
          Doadores de campanha, empresas e contratos de parlamentares federais — a
          partir de dados abertos. Você tira suas próprias conclusões.
        </p>
      </section>

      <SearchDirectory index={index} />
    </div>
  );
}
