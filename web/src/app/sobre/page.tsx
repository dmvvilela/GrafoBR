import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre e metodologia — GrafoBR",
  description:
    "Como o GrafoBR coleta e cruza dados públicos de parlamentares federais — fontes, método de pareamento, limitações e ressalvas.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{title}</h2>
      <div className="space-y-2.5 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

export default function SobrePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-9">
      <header className="space-y-3 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Sobre &amp; metodologia</h1>
        <p className="text-[15px] leading-relaxed text-zinc-400">
          O GrafoBR cruza <strong className="font-medium text-zinc-200">dados
          públicos por lei</strong> para mostrar conexões registradas de deputados
          federais — doadores de campanha, empresas, contratos, despesas de cota e
          emendas. São <strong className="font-medium text-zinc-200">conexões, não
          acusações</strong>: indicam o que está em registros oficiais, não
          irregularidade.
        </p>
      </header>

      <Section title="Fontes">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-zinc-600">
          <li>
            <strong className="text-zinc-300">Câmara dos Deputados</strong> — deputados
            em exercício e despesas da cota parlamentar (CEAP).
          </li>
          <li>
            <strong className="text-zinc-300">TSE</strong> — doações de campanha
            (eleições 2022).
          </li>
          <li>
            <strong className="text-zinc-300">Receita Federal</strong> — quadro de
            sócios (QSA) da base CNPJ.
          </li>
          <li>
            <strong className="text-zinc-300">CGU / Base dos Dados</strong> — contratos
            federais e emendas parlamentares individuais.
          </li>
        </ul>
      </Section>

      <Section title="Como cruzamos sócios (e por que isso exige cautela)">
        <p>
          A base CNPJ da Receita <strong className="text-zinc-300">mascara o CPF</strong>{" "}
          dos sócios (mostra apenas 6 dígitos do meio). Para ligar um deputado a uma
          empresa exigimos que coincidam, ao mesmo tempo: esses 6 dígitos, o nome
          normalizado <em>e</em> a faixa etária. Mesmo assim,{" "}
          <strong className="text-zinc-300">homônimos são possíveis</strong> — por isso
          tratamos cada ligação como ponto de partida para investigação, não como prova.
          Empresas com mero CPF coincidente mas nome diferente (ex.: grandes bancos) são
          descartadas.
        </p>
      </Section>

      <Section title="Contratos federais">
        <p>
          Ligamos uma empresa a um contrato quando o deputado é sócio dela{" "}
          <em>e</em> ela aparece nos contratos de compras do governo federal. É uma
          cadeia conservadora e rara: poucos deputados são sócios diretos de empresas
          com contratos federais.
        </p>
      </Section>

      <Section title="Emendas individuais">
        <p>
          Emendas individuais são a principal forma de um deputado{" "}
          <strong className="text-zinc-300">direcionar dinheiro federal</strong>.
          Usamos as emendas do tipo individual a partir de 2023 (mandato atual),
          atribuídas pelo nome do autor. Mostramos dois valores:{" "}
          <strong className="text-zinc-300">empenhado</strong> (comprometido) e{" "}
          <strong className="text-zinc-300">pago</strong> (efetivamente desembolsado) —
          a diferença entre os dois importa.
        </p>
      </Section>

      <Section title="Despesas de cota (CEAP)">
        <p>
          A cota parlamentar tem gastos comuns a quase todos (passagens, telefonia,
          combustível). Nos rankings destacamos os vetores onde o dinheiro tende a se
          concentrar — divulgação/publicidade, locação de veículos e aeronaves,
          consultorias.
        </p>
      </Section>

      <Section title="Limitações">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-zinc-600">
          <li>O cruzamento por nome/CPF mascarado pode conter homônimos.</li>
          <li>Os dados são um retrato estático, pré-computado — veja a data de atualização na página inicial.</li>
          <li>CPFs nunca são publicados; os identificadores no grafo são opacos.</li>
          <li>Ausência de conexão não significa ausência de relação — só ausência de registro nas fontes usadas.</li>
        </ul>
      </Section>

      <p className="border-t border-white/5 pt-5 text-xs leading-relaxed text-zinc-600">
        Projeto aberto, dados estáticos pré-computados. As conexões refletem registros
        públicos e não constituem acusação de irregularidade. Encontrou um erro? Os
        dados vêm direto das fontes oficiais citadas.
      </p>
    </div>
  );
}
