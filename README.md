# pseudo3d

Beveled-edge polygon rendering: a **2D outline** is offset inward and the side quads are shaded so it reads as extruded / pseudo-3D. Geometry is plain p5.js (`beginShape` / `vertex`); no WebGL.

**Run locally:** open `index.html` (sliders in the page) or serve the folder and load the same file.

**Run in the browser (no clone):** live sketch on the p5.js Web Editor — https://editor.p5js.org/timpyrkov/full/sAm_EgiI3

## p5.js global mode

The sketch uses **global mode** (`setup` / `draw` at top level) so it works in the online editor. In that environment, avoid local names that collide with **browser globals** or **p5 globals**: e.g. `inner` next to DOM `innerWidth` / `innerHeight` patterns, and `map` which would **shadow** p5’s [`map()`](https://p5js.org/reference/#/p5/map) value-remapping function. The bevel code uses names like `bevelInner` and `indexMap` instead.
