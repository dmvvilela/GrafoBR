import {
  contractDate,
  contractPeriod,
  type StateContractsSnapshot,
} from "@/lib/state-contracts";
const REASONS: Record<string, string> = {
  otherInstrument: "outros instrumentos, incluindo empenhos",
  notCompany: "fornecedor não classificado como pessoa jurídica",
  invalidCompanyId: "identificador da empresa inválido",
  invalidAgencyId: "identificador do órgão inválido",
  transferred: "órgão ou unidade sub-rogada",
  revenueOrUnknown: "receita ou natureza não informada",
  invalidAmount: "valor inicial inválido",
};
export default function ContractCoverage({
  data,
}: {
  data: StateContractsSnapshot;
}) {
  return (
    <details className="rounded-2xl border border-white/10 p-5 text-sm text-zinc-400">
      <summary className="cursor-pointer py-1 font-medium text-zinc-200">
        Fontes, cobertura e limites deste recorte
      </summary>
      <div className="mt-4 space-y-3 leading-relaxed">
        <p>
          Fonte:{" "}
          <a
            className="text-emerald-300 underline"
            href="https://www.gov.br/pncp/pt-br/acesso-a-informacao/dados-abertos"
            target="_blank"
            rel="noreferrer"
          >
            Portal Nacional de Contratações Públicas (PNCP)
          </a>
          . Consulta em {contractDate(data.fetchedAt)}. Publicações entre{" "}
          {contractPeriod(data.period)}, independentemente do ano da assinatura.
          Versão {data.version}.
        </p>
        <p>
          Órgãos classificados no PNCP como esfera estadual, de todos os
          poderes, com unidade contratante em SP ou MG. Somente o instrumento
          “Contrato” (tipo 1), de despesa, com fornecedor pessoa jurídica e
          identificação validada. Não inclui municípios, órgãos federais,
          empenhos, convênios, receitas ou registros com sub-rogação.
        </p>
        <p>
          O PNCP depende da publicação pelos órgãos. Este recorte não representa
          todos os contratos vigentes ou todo o gasto estadual. Soma de valores
          iniciais nominais, sem atualização monetária, aditivos ou pagamentos.
          Contratos plurianuais não são gastos de um único ano e não se somam às
          despesas liquidadas da página Estados.
        </p>
        <p>
          Fornecedores agrupados pela raiz validada do CNPJ: matriz e filiais da
          mesma pessoa jurídica. Conexões com grafos usam a mesma chave
          documental privada, nunca apenas o nome. Os dados históricos do grafo
          mantêm seus próprios períodos. Ausência de conexão significa ausência
          neste recorte, não ausência de relações.
        </p>
        <p>
          Foram conferidos{" "}
          {data.coverage.nationalRecordsChecked.toLocaleString("pt-BR")}{" "}
          registros nacionais, com todas as páginas de cada dia.{" "}
          {data.coverage.stateRecordsChecked.toLocaleString("pt-BR")} registros
          tinham esfera estadual e unidade em SP/MG;{" "}
          {data.contracts.length.toLocaleString("pt-BR")} atenderam aos
          critérios.
        </p>
        <ul className="list-inside list-disc">
          {Object.entries(data.coverage.excluded).map(([key, count]) => (
            <li key={key}>
              {count.toLocaleString("pt-BR")}: {REASONS[key] ?? key}
            </li>
          ))}
        </ul>
        <p>
          Contratos conectam órgãos e fornecedores. Não atribuímos a contratação
          pessoalmente ao governador nem inferimos irregularidade.
        </p>
      </div>
    </details>
  );
}
