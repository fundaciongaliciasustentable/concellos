"""Tests de scripts/actualizar.py sen rede."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import actualizar  # noqa: E402

CAPA = {'id': 'vut-concello', 'indicators': [{'id': 'vut_1000hab'}]}


def fila(cod, **extra):
    base = {
        'codigo_ine': cod,
        'nome': 'X',
        'vut': 3,
        'vut_1000hab': 1.5,
        'vut_1000hab_galicia': 2.0,
        'vut_1000hab_rel': -0.5,
        'vut_1000hab_periodo': '2026-10-01',
    }
    base.update(extra)
    return base


class FilasDaCapa(unittest.TestCase):
    def test_garda_so_os_campos_dos_indicadores_ordenados(self):
        out = actualizar.filas_da_capa(CAPA, [fila('36001'), fila('15001')])
        self.assertEqual([f['codigo_ine'] for f in out], ['15001', '36001'])
        self.assertNotIn('vut', out[0])
        self.assertEqual(out[0]['vut_1000hab_rel'], -0.5)

    def test_perfil_conserva_a_posicion(self):
        capa = {'id': 'perfil-concellos', 'indicators': []}
        f = {'codigo_ine': '15001', 'nome': 'A', 'provincia': 'A Coruña', 'lon': -8.3, 'lat': 43.2,
             'superficie_km2': 80.0, 'lugares': 20, 'outro': 1}
        out = actualizar.filas_da_capa(capa, [f])[0]
        self.assertEqual(out['lon'], -8.3)
        self.assertNotIn('outro', out)

    def test_falla_se_falta_un_campo(self):
        f = fila('15001')
        del f['vut_1000hab_galicia']
        with self.assertRaises(ValueError):
            actualizar.filas_da_capa(CAPA, [f])


if __name__ == '__main__':
    unittest.main()
