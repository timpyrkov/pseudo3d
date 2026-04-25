let seed = 42;
let numVertices = 12;
let noiseStrength = 0.3;
let animSpeed = 1.0;
let playing = true;
let animOffset = 0;
let bevelThickness = 20;
let lightAngle = 45;

const W = 400;
const H = 400;
const BASE_RADIUS = Math.min(W, H) / 3;

function getSlider(id) {
  return document.getElementById(id);
}

function setVal(id, val) {
  document.getElementById(id).textContent = val;
}

new p5(function (p) {
  p.setup = function () {
    const cnv = p.createCanvas(W, H);
    cnv.parent('canvas-container');
    p.colorMode(p.RGB, 255, 255, 255, 255);

    // Wire up sliders
    getSlider('slider-seed').addEventListener('input', function () {
      seed = parseInt(this.value);
      setVal('val-seed', seed);
    });

    getSlider('slider-vertices').addEventListener('input', function () {
      numVertices = parseInt(this.value);
      setVal('val-vertices', numVertices);
    });

    getSlider('slider-noise').addEventListener('input', function () {
      noiseStrength = parseFloat(this.value);
      setVal('val-noise', noiseStrength.toFixed(2));
    });

    getSlider('slider-bevel').addEventListener('input', function () {
      bevelThickness = parseFloat(this.value);
      setVal('val-bevel', bevelThickness.toFixed(0));
    });

    getSlider('slider-light').addEventListener('input', function () {
      lightAngle = parseFloat(this.value);
      setVal('val-light', lightAngle.toFixed(0));
    });

    getSlider('slider-speed').addEventListener('input', function () {
      animSpeed = Math.pow(10, parseFloat(this.value) * 2 - 1);
      setVal('val-speed', animSpeed.toFixed(2));
    });

    document.getElementById('btn-playpause').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? '⏸ Pause' : '▶ Play';
    });
  };

  p.draw = function () {
    if (playing) {
      animOffset += 0.005 * animSpeed;
    }

    p.background(20, 20, 28);

    // Build outer polygon
    const outer = buildShape(p, seed, numVertices, noiseStrength, animOffset);
    const n = outer.length;

    // Compute inner polygon (bevel offset)
    const { inner } = computeBevel(outer, bevelThickness);

    // Fill outer shape
    p.fill(30, 144, 255); // dodgerblue
    p.noStroke();
    p.beginShape();
    for (const v of outer) p.vertex(v.x, v.y);
    p.endShape(p.CLOSE);

    // Wireframe overlay
    p.stroke(255);
    p.strokeWeight(1);
    p.noFill();

    // Outer edges
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      p.line(outer[i].x, outer[i].y, outer[j].x, outer[j].y);
    }

    // Inner edges (skip collapsed — both endpoints coincide)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = inner[j].x - inner[i].x;
      const dy = inner[j].y - inner[i].y;
      if (dx * dx + dy * dy > 1) {
        p.line(inner[i].x, inner[i].y, inner[j].x, inner[j].y);
      }
    }

    // Connectors (outer vertex → inner vertex)
    for (let i = 0; i < n; i++) {
      p.line(outer[i].x, outer[i].y, inner[i].x, inner[i].y);
    }
  };
});

// --------------- shape builder ---------------

function buildShape(p, seed, n, noiseStr, timeOffset) {
  p.randomSeed(seed);
  p.noiseSeed(seed);

  const cx = W / 2;
  const cy = H / 2;
  const verts = [];

  for (let i = 0; i < n; i++) {
    const angle = (p.TWO_PI / n) * i - p.HALF_PI;

    // Noise sample: use angle as x-axis and time as y-axis
    const nx = p.cos(angle) * 1.5 + 2;
    const ny = p.sin(angle) * 1.5 + 2;
    const nVal = p.noise(nx + timeOffset, ny + timeOffset); // 0..1
    const distortion = p.map(nVal, 0, 1, 1 - noiseStr, 1 + noiseStr);

    const r = BASE_RADIUS * distortion;
    verts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }

  return verts;
}

// --------------- bevel offset ---------------

function computeBevel(outer, bevel) {
  const n = outer.length;

  // Trivial case: no bevel
  if (n < 3 || bevel <= 0) {
    return { inner: outer.map(function (v) { return { x: v.x, y: v.y }; }) };
  }

  // Per-edge direction vectors and inward unit normals.
  // Polygon is CW in screen coords, so inward normal = (-dy, dx)/len.
  var edgeDir = [];
  var edgeNorm = [];
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    var dx = outer[j].x - outer[i].x;
    var dy = outer[j].y - outer[i].y;
    var len = Math.sqrt(dx * dx + dy * dy);
    edgeDir.push({ x: dx, y: dy });
    if (len > 1e-10) {
      edgeNorm.push({ x: -dy / len, y: dx / len });
    } else {
      edgeNorm.push({ x: 0, y: 0 });
    }
  }

  // Intersection of offset-line-a and offset-line-b.
  // Each offset line is the original edge shifted inward by `bevel`.
  function offsetIntersect(a, b) {
    var p1x = outer[a].x + bevel * edgeNorm[a].x;
    var p1y = outer[a].y + bevel * edgeNorm[a].y;
    var d1x = edgeDir[a].x;
    var d1y = edgeDir[a].y;

    var p2x = outer[b].x + bevel * edgeNorm[b].x;
    var p2y = outer[b].y + bevel * edgeNorm[b].y;
    var d2x = edgeDir[b].x;
    var d2y = edgeDir[b].y;

    var cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) {
      // Nearly parallel — return midpoint of the two offset points
      return { x: (p1x + p2x) / 2, y: (p1y + p2y) / 2 };
    }
    var t = ((p2x - p1x) * d2y - (p2y - p1y) * d2x) / cross;
    return { x: p1x + t * d1x, y: p1y + t * d1y };
  }

  // Centroid — used later for clamping
  var pcx = 0, pcy = 0;
  for (var i = 0; i < n; i++) { pcx += outer[i].x; pcy += outer[i].y; }
  pcx /= n; pcy /= n;

  // Start with every edge active
  var active = [];
  for (var i = 0; i < n; i++) active.push(i);

  // Iteratively remove ONE edge per pass (the most-collapsed),
  // then recompute — safer than batch removal for interacting edges.
  var changed = true;
  while (changed && active.length >= 3) {
    changed = false;
    var m = active.length;
    var worstIdx = -1;
    var worstDot = 0;

    for (var idx = 0; idx < m; idx++) {
      var prevE = active[(idx - 1 + m) % m];
      var e     = active[idx];
      var nextE = active[(idx + 1) % m];

      var mStart = offsetIntersect(prevE, e);
      var mEnd   = offsetIntersect(e, nextE);

      // Dot inner-edge direction with outer-edge direction
      var ix = mEnd.x - mStart.x;
      var iy = mEnd.y - mStart.y;
      var dot = ix * edgeDir[e].x + iy * edgeDir[e].y;

      if (dot < worstDot) {
        worstDot = dot;
        worstIdx = idx;
      }
    }

    if (worstIdx >= 0) {
      active.splice(worstIdx, 1);
      changed = true;
    }
  }

  // Assign an inner vertex for every outer vertex.
  // Each miter point at the junction of consecutive active edges covers
  // all outer vertices between those two edges (collapsed ones included).
  var inner = new Array(n);
  var m = active.length;

  if (m < 2) {
    // Everything collapsed — map to centroid
    for (var i = 0; i < n; i++) inner[i] = { x: pcx, y: pcy };
  } else {
    for (var idx = 0; idx < m; idx++) {
      var e     = active[idx];
      var nextE = active[(idx + 1) % m];
      var miter = offsetIntersect(e, nextE);

      // Walk from outer vertex (e+1)%n to nextE inclusive
      var v = (e + 1) % n;
      while (true) {
        inner[v] = { x: miter.x, y: miter.y };
        if (v === nextE) break;
        v = (v + 1) % n;
      }
    }
  }

  // Post-process: clamp any inner vertex that escapes outward.
  // An inner vertex must not be further from centroid than its outer vertex,
  // and the displacement outer→inner must point inward (toward centroid).
  for (var i = 0; i < n; i++) {
    var toCx = pcx - outer[i].x;
    var toCy = pcy - outer[i].y;
    var toCLen = Math.sqrt(toCx * toCx + toCy * toCy);

    var dx = inner[i].x - outer[i].x;
    var dy = inner[i].y - outer[i].y;

    // dot > 0 means inner vertex is on the centroid side
    var dot = dx * toCx + dy * toCy;

    // Also check: inner must not be further from centroid than outer
    var odr2 = (outer[i].x - pcx) * (outer[i].x - pcx) +
               (outer[i].y - pcy) * (outer[i].y - pcy);
    var idr2 = (inner[i].x - pcx) * (inner[i].x - pcx) +
               (inner[i].y - pcy) * (inner[i].y - pcy);

    if (dot < 0 || idr2 > odr2) {
      // Fallback: move inward from outer vertex toward centroid by bevel
      if (toCLen > 1e-10) {
        var s = Math.min(bevel, toCLen) / toCLen;
        inner[i] = { x: outer[i].x + toCx * s, y: outer[i].y + toCy * s };
      } else {
        inner[i] = { x: pcx, y: pcy };
      }
    }
  }

  return { inner: inner };
}
