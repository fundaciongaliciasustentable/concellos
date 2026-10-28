#!/usr/bin/env python3
"""Xera index.html (galego) e es/index.html (castelán) desde un único modelo.

Os textos da interface do cliente están en js/textos.js; aquí só os da páxina estática
(título, descrición, etiquetas e pé). Edita este ficheiro e volve executalo:

    python3 scripts/xerar_paxinas.py
"""

import json
import re
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SITIO = 'https://concellos.galiciasustentable.org'
FGS = 'https://fundaciongaliciasustentable.gal'

# Textos estáticos; os da interface saen de js/textos.js para non duplicalos.
PAXINA = {
    'gl': {
        'titulo': 'Retrato dos concellos — Fundación Galicia Sustentable',
        'nome': 'Retrato dos concellos',
        'descricion': 'Cada concello fronte aos outros 312: indicadores de poboación, servizos, '
        'vivenda e conectividade nun mapa que se reordena.',
        'saltar': 'Ir ao contido',
        'outra': 'Castelán',
        'datos': 'Datos de Galicia Agora',
        'about': 'Organización privada sen ánimo de lucro constituída en 2008 co propósito de '
        'transformar Galicia nunha sociedade sustentable.',
        'declared': 'Declarada de interese ambiental e galego en 2009.',
        'foundation': 'Fundación', 'the_foundation': 'A Fundación', 'team': 'Equipo',
        'transparency': 'Transparencia', 'contact': 'Contacto', 'ecosystem': 'Ecosistema',
        'projects': 'Proxectos', 'magazine': 'Revista', 'donations': 'Doazóns', 'media': 'Medios',
        'support': 'Apoia a fundación', 'support_text': 'O teu apoio fai posible o noso traballo.',
        'donate': 'Doar agora', 'legal': 'Espazo legal', 'notice': 'Aviso legal',
        'privacy': 'Privacidade', 'cookies': 'Cookies', 'ai': 'Política de IA',
        'licenza': 'Código AGPL-3.0. Datos: a licenza de cada fonte, indicada en cada grupo.',
    },
    'es': {
        'titulo': 'Retrato de los ayuntamientos — Fundación Galicia Sustentable',
        'nome': 'Retrato de los ayuntamientos',
        'descricion': 'Cada ayuntamiento frente a los otros 312: indicadores de población, '
        'servicios, vivienda y conectividad en un mapa que se reordena.',
        'saltar': 'Ir al contenido',
        'outra': 'Galego',
        'datos': 'Datos de Galicia Agora',
        'about': 'Organización privada sin ánimo de lucro constituida en 2008 con el propósito de '
        'transformar Galicia en una sociedad sustentable.',
        'declared': 'Declarada de interés ambiental y gallego en 2009.',
        'foundation': 'Fundación', 'the_foundation': 'La Fundación', 'team': 'Equipo',
        'transparency': 'Transparencia', 'contact': 'Contacto', 'ecosystem': 'Ecosistema',
        'projects': 'Proyectos', 'magazine': 'Revista', 'donations': 'Donaciones', 'media': 'Medios',
        'support': 'Apoya a la fundación', 'support_text': 'Tu apoyo hace posible nuestro trabajo.',
        'donate': 'Donar ahora', 'legal': 'Espacio legal', 'notice': 'Aviso legal',
        'privacy': 'Privacidad', 'cookies': 'Cookies', 'ai': 'Política de IA',
        'licenza': 'Código AGPL-3.0. Datos: la licencia de cada fuente, indicada en cada grupo.',
    },
}


def textos_cliente():
    """Le o obxecto TEXTOS de js/textos.js (JSON dentro dun módulo)."""
    js = (RAIZ / 'js' / 'textos.js').read_text()
    return json.loads(js[js.index('{'):js.rindex('}') + 1])


def paxina(lang, t, x):
    raiz = './' if lang == 'gl' else '../'
    outra = 'es' if lang == 'gl' else 'gl'
    outra_url = f'{raiz}es/' if lang == 'gl' else raiz
    p = lambda s: f"{FGS}{'/es' if lang == 'es' else ''}/{s}/index.html"
    fgs_home = f'{FGS}/es/' if lang == 'es' else f'{FGS}/'
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t['titulo']}</title>
<meta name="description" content="{t['descricion']}">
<link rel="canonical" href="{SITIO}/{'' if lang == 'gl' else 'es/'}">
<link rel="alternate" hreflang="gl" href="{SITIO}/">
<link rel="alternate" hreflang="es" href="{SITIO}/es/">
<link rel="icon" href="{raiz}assets/logos/favicon.svg" type="image/svg+xml">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="stylesheet" href="{raiz}assets/css/concellos.css">
</head>
<body>
<a class="skip-link" href="#contido">{t['saltar']}</a>
<header class="cn-header">
  <div class="inner">
    <div class="cn-ident">
      <a href="{fgs_home}"><img src="{raiz}assets/logos/logo-fgs-horizontal-branco.png" alt="Fundación Galicia Sustentable" width="129" height="55"></a>
      <span class="cn-sep" aria-hidden="true"></span>
      <a class="cn-nome" href="{raiz if lang == 'gl' else raiz + 'es/'}">{t['nome']}</a>
    </div>
    <nav aria-label="{t['nome']}">
      <a href="https://agora.galiciasustentable.org/">{t['datos']}</a>
      <a href="{outra_url}" lang="{outra}" hreflang="{outra}">{t['outra']}</a>
    </nav>
  </div>
</header>

<div class="rt-app" data-lang="{lang}" data-base="{raiz}">
  <div class="rt-side">
    <div class="rt-search">
      <label for="rt-q">{x['portrait_search']}</label>
      <input id="rt-q" type="search" list="rt-concellos" autocomplete="off" spellcheck="false">
      <datalist id="rt-concellos"></datalist>
    </div>
    <div class="rt-compare">
      <ol class="rt-refs"></ol>
      <details class="rt-compare-add">
        <summary>{x['portrait_compare']}</summary>
        <input id="rt-ref" type="search" list="rt-concellos" autocomplete="off" spellcheck="false" aria-label="{x['portrait_compare']}">
        <p class="rt-hint">{x['portrait_compare_hint']}</p>
      </details>
    </div>
    <p class="rt-status" role="status">{x['loading']}</p>
    <div class="rt-list" id="contido"></div>
    <p class="rt-updated"></p>
  </div>
  <div class="rt-stage-wrap">
    <div class="rt-stage">
      <canvas class="rt-canvas" role="img" aria-label="{x['portrait_canvas']}"></canvas>
      <div class="rt-tip" hidden></div>
      <div class="rt-stage-foot">
        <p class="rt-legend">{x['portrait_legend']}</p>
        <div class="rt-modes" role="group" aria-label="{x['portrait_view']}">
          <button type="button" data-mode="strip" aria-pressed="true">{x['portrait_strip']}</button>
          <button type="button" data-mode="map" aria-pressed="false">{x['portrait_map']}</button>
        </div>
      </div>
    </div>
  </div>
</div>

<footer class="gs-footer">
  <div class="gs-footer__grid">
    <div class="gs-footer__marca">
      <p>{t['about']}</p>
      <p>{t['declared']}</p>
      <p>{t['licenza']}</p>
    </div>
    <nav aria-label="{t['foundation']}">
      <h2>{t['foundation']}</h2>
      <ul>
        <li><a href="{p('a-fundacion')}">{t['the_foundation']}</a></li>
        <li><a href="{p('equipo')}">{t['team']}</a></li>
        <li><a href="{p('transparencia')}">{t['transparency']}</a></li>
        <li><a href="{p('contacto')}">{t['contact']}</a></li>
      </ul>
    </nav>
    <nav aria-label="{t['ecosystem']}">
      <h2>{t['ecosystem']}</h2>
      <ul>
        <li><a href="{fgs_home}">{t['foundation']}</a></li>
        <li><a href="https://galiciasustentable.org/proxectos/">{t['projects']}</a></li>
        <li><a href="https://galiciasustentable.org/">{t['magazine']}</a></li>
        <li><a href="{p('doar')}">{t['donations']}</a></li>
        <li><a href="{p('medios')}">{t['media']}</a></li>
      </ul>
    </nav>
    <div class="gs-footer__apoio">
      <h2>{t['support']}</h2>
      <p>{t['support_text']}</p>
      <a class="gs-footer__boton" href="{p('doar')}">{t['donate']}</a>
    </div>
  </div>
  <div class="gs-footer__legal">
    <span>© {date.today().year} Fundación Galicia Sustentable · CIF G70193537</span>
    <nav aria-label="{t['legal']}">
      <a href="{p('aviso-legal')}">{t['notice']}</a>
      <a href="{p('privacidade')}">{t['privacy']}</a>
      <a href="{p('cookies')}">{t['cookies']}</a>
      <a href="{p('politica-ia')}">{t['ai']}</a>
    </nav>
  </div>
</footer>

<script type="module">
  import {{ start }} from '{raiz}js/retrato.js';
  start();
</script>
</body>
</html>
"""


def main():
    x = textos_cliente()
    for lang, destino in (('gl', RAIZ / 'index.html'), ('es', RAIZ / 'es' / 'index.html')):
        destino.parent.mkdir(exist_ok=True)
        html = paxina(lang, PAXINA[lang], x[lang])
        assert not re.search(r'\{[a-z_]+\}', html), 'quedou un marcador sen substituír'
        destino.write_text(html)
        print(destino.relative_to(RAIZ))


if __name__ == '__main__':
    main()
