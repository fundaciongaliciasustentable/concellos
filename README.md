# Retrato dos concellos

Cada concello de Galicia fronte aos outros 312. Os 313 concellos son puntos: primeiro
forman o mapa de Galicia e, ao percorrer os indicadores, ordénanse segundo o valor co
concello escollido destacado. Promove a [Fundación Galicia Sustentable](https://fundaciongaliciasustentable.gal).

Enderezo: https://concellos.galiciasustentable.org (galego) e `/es/` (castelán).

Saíu de [Galicia Agora](https://github.com/fundaciongaliciasustentable/galicia-agora)
(páxina `/retrato/`) para funcionar como proxecto propio. Os datos seguen
saíndo das capas que publica Galicia Agora, pero copiados aquí: o sitio non depende
del para funcionar.

## Estrutura

```
index.html, es/index.html  páxinas (XERADAS por scripts/xerar_paxinas.py, non editar a man)
js/retrato.js              cliente: canvas, animación mapa ↔ distribución, tarxetas
js/layout.js               xeometría pura (proxección, escalas, beeswarm, posición)
js/escala.js               clases de cor fronte a Galicia (as mesmas de Galicia Agora)
js/textos.js               textos da interface en galego e castelán
assets/                    CSS, fontes Source Sans 3 (OFL) e logos da FGS
datos/                     copia das capas por concello, un ficheiro por capa
scripts/                   actualizar datos, xerar páxinas, empaquetar
tests/                     node:test (js) e unittest (scripts)
```

Sen dependencias nin paso de compilación: o que hai no repositorio é o que se publica.

## Regras

- Nada doutra orixe no navegador: nin scripts, nin fontes, nin imaxes. Sen cookies nin
  analítica. `scripts/empaquetar.sh` falla se aparece algún recurso externo.
- Un ficheiro por capa en `datos/`: as licenzas (ODbL, CC BY-SA 4.0) non se mesturan.
  Cada grupo da páxina amosa a fonte, a licenza e a atribución da súa capa.
- As cores indican distancia ao valor de Galicia, non mellor ou peor. A posición
  descríbese en termos neutros («máis alto ca no 78 % dos concellos»), sen clasificacións.
- «sustentable», nunca «sostible». Interface en galego (raíz) e castelán (`/es/`).

## Actualizar os datos

```bash
python3 scripts/actualizar.py
```

Baixa o catálogo de https://agora.galiciasustentable.org/data/catalog.json e as táboas
das capas unidas aos concellos que teñen indicadores. Se falta `perfil-concellos`, se
unha capa trae menos de 300 concellos ou se falta un campo, non toca `datos/`.

## Probar

```bash
npm test
npm run preview
```

`npm test` non instala nada: usa `node --test` e `python3 -m unittest`. A vista previa
serve en http://localhost:8790.

## Publicar

```bash
./scripts/empaquetar.sh
```

Rexenera as páxinas e deixa en `dist/` (e en `concellos-web.zip`) só os ficheiros
públicos. Sube o contido de `dist/` á raíz do subdominio en Dinahosting.

## Licenzas

- Código: [AGPL-3.0](LICENSE).
- Datos: os de cada capa orixinal (ver `datos/<capa>.json`, campo `capa.licence`).
- Fonte Source Sans 3: SIL Open Font License (`assets/fonts/OFL.txt`).
