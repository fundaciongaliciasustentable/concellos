#!/usr/bin/env python3
"""Copia en datos/ as capas por concello que publica Galicia Agora.

Le o catálogo de https://agora.galiciasustentable.org/data/catalog.json, colle as capas
unidas aos concellos (join a concellos-parroquias) que teñen indicadores e baixa a súa
táboa (data/<id>/table.json). Garda un ficheiro por capa, porque as licenzas das capas
non se poden mesturar nun mesmo ficheiro (ODbL fronte a CC BY-SA 4.0), e un índice.

Nunca deixa datos a medias: se falta perfil-concellos, se unha capa trae menos de 300
concellos ou se falta algún campo dun indicador, sae con erro sen tocar datos/.

Uso:  python3 scripts/actualizar.py [--orixe URL]
Só biblioteca estándar.
"""

import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ORIXE = 'https://agora.galiciasustentable.org'
UA = 'RetratoConcellos/1.0 (+https://concellos.galiciasustentable.org; galiciasustentable@galiciasustentable.org)'
JOIN = 'concellos-parroquias'
PERFIL = 'perfil-concellos'
MIN_CONCELLOS = 300
# Campos de perfil-concellos que usa a páxina para debuxar cada concello.
CAMPOS_PERFIL = ['nome', 'provincia', 'lon', 'lat', 'superficie_km2', 'lugares']
# Campos da capa que se conservan (o resto do catálogo de Galicia Agora non fai falta).
CAMPOS_CAPA = ['id', 'title', 'operator', 'source_url', 'licence', 'attribution']

DATOS = Path(__file__).resolve().parent.parent / 'datos'


def baixar(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def filas_da_capa(capa, filas):
    """Só codigo_ine, nome e os campos dos indicadores (e os de posición no perfil)."""
    campos = ['codigo_ine', 'nome']
    if capa['id'] == PERFIL:
        campos += [c for c in CAMPOS_PERFIL if c != 'nome']
    for ind in capa['indicators']:
        i = ind['id']
        campos += [i, f'{i}_galicia', f'{i}_rel', f'{i}_periodo']
    saida = []
    for f in filas:
        falta = [c for c in campos if c not in f]
        if falta:
            raise ValueError(f"{capa['id']}: á fila {f.get('codigo_ine')} fáltalle {falta}")
        saida.append({c: f[c] for c in campos})
    return sorted(saida, key=lambda f: f['codigo_ine'])


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--orixe', default=ORIXE, help='sitio de Galicia Agora (por defecto, %(default)s)')
    args = ap.parse_args()
    orixe = args.orixe.rstrip('/')

    catalogo = baixar(f'{orixe}/data/catalog.json')
    capas = [
        c
        for c in catalogo['layers']
        if (c.get('join') or {}).get('layer') == JOIN and c.get('indicators') and c.get('meta')
    ]
    if not any(c['id'] == PERFIL for c in capas):
        sys.exit(f'Erro: o catálogo non trae {PERFIL}; non se cambia nada.')

    ficheiros = {}
    for capa in capas:
        filas = filas_da_capa(capa, baixar(f"{orixe}/data/{capa['id']}/table.json"))
        if len(filas) < MIN_CONCELLOS:
            sys.exit(f"Erro: {capa['id']} só trae {len(filas)} concellos; non se cambia nada.")
        meta = capa['meta']
        ficheiros[capa['id']] = {
            'capa': {
                **{k: capa[k] for k in CAMPOS_CAPA if k in capa},
                'meta': {k: meta.get(k) for k in ('status', 'published_at', 'last_success_at')},
                'copiado_de': f"{orixe}/data/{capa['id']}/table.json",
            },
            'indicadores': capa['indicators'],
            'filas': filas,
        }
        print(f"{capa['id']}: {len(filas)} concellos, {len(capa['indicators'])} indicadores, {meta.get('status')}")

    # Escritura ao final, cando todo baixou e se validou.
    DATOS.mkdir(exist_ok=True)
    for vello in DATOS.glob('*.json'):
        if vello.stem not in ficheiros and vello.name != 'indice.json':
            vello.unlink()
    for id_, contido in ficheiros.items():
        (DATOS / f'{id_}.json').write_text(json.dumps(contido, ensure_ascii=False, separators=(',', ':')) + '\n')
    indice = {
        'xerado': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'orixe': orixe,
        'capas': sorted(ficheiros),
    }
    (DATOS / 'indice.json').write_text(json.dumps(indice, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(ficheiros)} capas gardadas en {DATOS}')


if __name__ == '__main__':
    main()
