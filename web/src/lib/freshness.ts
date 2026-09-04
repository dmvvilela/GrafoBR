export const SOURCE_DETAILS: Record<string, { name: string; url: string }> = {
  camara: {
    name: "Câmara dos Deputados",
    url: "https://dadosabertos.camara.leg.br/",
  },
  senado: {
    name: "Senado Federal",
    url: "https://www12.senado.leg.br/dados-abertos",
  },
  camara_ceap: {
    name: "Cota parlamentar (CEAP)",
    url: "https://dadosabertos.camara.leg.br/",
  },
  tse: {
    name: "Doações eleitorais (TSE)",
    url: "https://dadosabertos.tse.jus.br/",
  },
  receita: {
    name: "Receita Federal / CNPJ",
    url: "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/cnpj/dados-publicos-cnpj",
  },
  transparencia: {
    name: "Contratos federais",
    url: "https://portaldatransparencia.gov.br/contratos",
  },
  cgu_emendas: {
    name: "Emendas individuais (CGU)",
    url: "https://portaldatransparencia.gov.br/emendas",
  },
};

export function formatSnapshotDate(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value)))
    return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
