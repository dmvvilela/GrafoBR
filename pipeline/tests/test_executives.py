import csv
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
import duckdb
from grafobr_pipeline.executives import load_roster, match_candidates
from grafobr_pipeline.build_ego_networks import BuildContext, expand_ego_network, to_contract
from grafobr_pipeline.emit import validate

class ExecutivesTest(unittest.TestCase):
    def test_roster_covers_all_jurisdictions_and_expires(self):
        roster=load_roster(today=date(2026,11,13))
        self.assertEqual(len(roster),28)
        self.assertEqual(next(e['name'] for e in roster if e['uf']=='MG'),'Mateus Simões')
        with self.assertRaises(ValueError): load_roster(today=date(2027,2,1))

    def test_no_running_mate_or_supplementary_election_borrowing(self):
        entry=dict(id=1000001,name='Pessoa Exemplo',fullName='PESSOA EXEMPLO',uf='SP',chamber='governo',campaignOffice='VICE-GOVERNADOR',verifiedAt='2026-11-13',sourceUrl='https://www.sp.gov.br/',note='Titular')
        row=dict(ANO_ELEICAO='2022',DT_ELEICAO='02/10/2022',NM_CANDIDATO='PESSOA EXEMPLO',SG_UF='SP',DS_CARGO='VICE-GOVERNADOR',SQ_CANDIDATO='42',NR_CPF_CANDIDATO='12345678901',DT_NASCIMENTO='01/01/1970',NM_URNA_CANDIDATO='EXEMPLO',SG_PARTIDO='XX')
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'candidates.csv'
            def write(rows):
                with path.open('w',encoding='latin1',newline='') as f:
                    w=csv.DictWriter(f,fieldnames=list(row),delimiter=';');w.writeheader();w.writerows(rows)
            write([row,{**row,'SQ_CANDIDATO':'99','DT_ELEICAO':'21/06/2026'}])
            self.assertEqual(match_candidates([entry],path)[0]['sq_candidate'],'42')
            write([{**row,'DS_CARGO':'GOVERNADOR'}])
            with self.assertRaises(ValueError): match_candidates([entry],path)
            write([row,{**row,'SQ_CANDIDATO':'43'}])
            with self.assertRaises(ValueError): match_candidates([entry],path)

    def test_no_parliamentary_attribution_and_shared_identity_across_offices(self):
        con=duckdb.connect()
        con.execute('create table tse_receipts(sq_candidate varchar, donor_key varchar, donor_name varchar, receipt_date varchar, amount double)')
        con.execute("insert into tse_receipts values ('42','donor:private','Doador','2022-09-01',100)")
        con.execute('create table camara_expenses(unused int)')
        con.execute('create table emendas(unused int)')
        office=dict(verifiedAt='2026-11-13',sourceUrl='https://www.sp.gov.br/',note='Titular',campaignYear=2022,campaignOffice='VICE-GOVERNADOR',campaignParty='XX')
        seed=dict(camara_id=1000001,name='Pessoa Exemplo',chamber='governo',sq_candidate='42',cpf=None,office=office)
        registry={}
        graph=to_contract(expand_ego_network(con,seed,BuildContext()),seed,BuildContext(),registry)
        validate(graph)
        self.assertEqual([e['connectionType'] for e in graph['links']],['doacao'])
        self.assertEqual(graph['meta']['sources'],['executivo','tse'])
        self.assertNotIn('private',json.dumps(graph))
        self.assertNotIn('sq_candidate',json.dumps(graph))
        con.execute('drop table camara_expenses');con.execute('drop table emendas')
        other={**seed,'camara_id':123,'name':'Outro','chamber':'camara'}
        other_graph=to_contract(expand_ego_network(con,other,BuildContext()),other,BuildContext(),registry)
        self.assertEqual(graph['nodes'][1]['entityId'],other_graph['nodes'][1]['entityId'])
        con.close()

    def test_duplicate_receipts_never_double_count_or_choose_conflicting_revision(self):
        from grafobr_pipeline.tse import verified_receipts
        row=dict(SQ_CANDIDATO="42", SQ_RECEITA="1", VR_RECEITA="100,00", NR_CPF_CNPJ_DOADOR="12345678901", DT_RECEITA="01/09/2022")
        self.assertEqual(list(verified_receipts(iter([row, row]))), [row])
        self.assertEqual(list(verified_receipts(iter([row, {**row, "VR_RECEITA":"200,00"}, row]))), [])
        self.assertEqual(list(verified_receipts(iter([{**row, "SQ_RECEITA":"#NULO"}]))), [])
