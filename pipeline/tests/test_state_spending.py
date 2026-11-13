import copy
import unittest
from grafobr_pipeline.state_spending import normalize, populations


def cell(annex, account, value, code='TotalDespesas', **extra):
    return dict(exercicio=2025, cod_ibge=35, uf='SP', anexo=f'DCA-Anexo I-{annex}',
        rotulo='Total Geral da Despesa por Função' if annex=='E' else 'Padrão',
        coluna='Despesas Liquidadas', conta=account, cod_conta=code, valor=value, **extra)


class SpendingTest(unittest.TestCase):
    def setUp(self):
        self.e=[cell('E','Despesas Exceto Intraorçamentárias',100),cell('E','10 - Saúde',40),
                cell('E','12 - Educação',60),cell('E','10.301 - Atenção Básica',30),
                cell('E','Despesas Intraorçamentárias',10)]
        self.d=[cell('D','Total Geral da Despesa',110),cell('D','Investimentos',25,'DO4.4.00.00.00.00'),
                cell('D','Aplicações Diretas',20,'DO4.4.90.00.00.00'),
                cell('D','Equipamentos',15,'DO4.4.90.52.00.00'),
                cell('D','Intra',5,'DI4.4.91.00.00.00')]

    def test_excludes_intra_subfunctions_and_investment_children(self):
        r=normalize(self.e,self.d,35,2025)
        self.assertEqual(r['total'],100)
        self.assertEqual(r['functions'],{'10':40,'12':60})
        self.assertEqual(r['investment'],20)
        self.assertNotIn('06',r['functions']) # missing is not zero

    def test_missing_report_is_null_not_zero(self):
        self.assertEqual(normalize([],[],35,2025)['total'],None)
        self.assertEqual(normalize(self.e,[],35,2025)['investment'],None)

    def test_duplicate_cells_rejected_even_when_identical(self):
        with self.assertRaisesRegex(ValueError,'Duplicate'):
            normalize(self.e+[self.e[0]],self.d,35,2025)

    def test_wrong_year_or_geography_rejected(self):
        for key,value in [('exercicio',2024),('cod_ibge',31),('uf','MG'),('anexo','DCA-Anexo I-D')]:
            rows=copy.deepcopy(self.e);rows[0][key]=value
            with self.assertRaisesRegex(ValueError,'identity'):
                normalize(rows,self.d,35,2025)

    def test_functions_and_annexes_must_reconcile(self):
        rows=copy.deepcopy(self.e);rows[1]['valor']=41.01
        with self.assertRaisesRegex(ValueError,'reconcile'):normalize(rows,self.d,35,2025)
        rows=copy.deepcopy(self.d);rows[0]['valor']=120
        with self.assertRaisesRegex(ValueError,'disagree'):normalize(self.e,rows,35,2025)
        rows=copy.deepcopy(self.d);rows[-1]['valor']=2
        with self.assertRaisesRegex(ValueError,'modalities'):normalize(self.e,rows,35,2025)

    def test_negative_and_nonfinite_amount_rejected(self):
        for invalid in [-1,float('nan'),float('inf')]:
            rows=copy.deepcopy(self.e);rows[1]['valor']=invalid
            with self.assertRaises(ValueError):normalize(rows,self.d,35,2025)

    def test_population_must_cover_exactly_27_ufs(self):
        with self.assertRaisesRegex(ValueError,'coverage'):
            populations([dict(id='9324',unidade='Pessoas',resultados=[dict(series=[])])])

if __name__=='__main__':unittest.main()
