<h1><p align="left">
  <img src="https://github.com/timpyrkov/p5js-pseudo3d/blob/master/img/logo.png?raw=true" alt="P5JS Pseudo3d logo" height="30" style="vertical-align: middle; margin-right: 10px;">
  <span style="font-size:2.5em; vertical-align: middle;"><b>P5JS Pseudo3d</b></span>
</p></h1>

**Live demo:** https://editor.p5js.org/timpyrkov/sketches/sAm_EgiI3

![Dashboard preview](https://github.com/timpyrkov/p5js-pseudo3d/blob/master/img/dashboard.jpg?raw=true)


Beveled-edge polygon rendering: a **2D outline** is offset inward and the side quads are shaded so it reads as extruded / pseudo-3D. Geometry is plain p5.js (`beginShape` / `vertex`); no WebGL.

**Run locally:** open `index.html` (sliders in the page) or serve the folder and load the same file.

## Disclaimer

Works well on simple polygons with no self-intersections (convex or slightly concave). May break on complex self-intersecting polygons.