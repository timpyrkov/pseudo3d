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
    const { inner, outerMap } = computeBevel(outer, bevelThickness);

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
    const m = inner.length;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      const dx = inner[j].x - inner[i].x;
      const dy = inner[j].y - inner[i].y;
      if (dx * dx + dy * dy > 0.25) {
        p.line(inner[i].x, inner[i].y, inner[j].x, inner[j].y);
      }
    }

    // Connectors (outer vertex → inner vertex)
    for (let i = 0; i < m; i++) {
      const oi = outerMap[i];
      p.line(outer[oi].x, outer[oi].y, inner[i].x, inner[i].y);
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
    var copy = outer.map(function (v) { return { x: v.x, y: v.y }; });
    var map = []; for (var i = 0; i < n; i++) map.push(i);
    return { inner: copy, outerMap: map };
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

  var result = fixSelfIntersections(inner, outer);
  postProcessBevel(result.inner, result.outerMap, outer);
  return result;
}

// --------------- self-intersection fix ---------------

// Segment–segment intersection (open intervals, no endpoints).
// Returns { point, tA, tB } or null.
function segSegIntersect(a, b, c, d) {
  var EPS = 1e-9;
  var dx1 = b.x - a.x, dy1 = b.y - a.y;
  var dx2 = d.x - c.x, dy2 = d.y - c.y;
  var cross = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(cross) < EPS) return null;
  var fx = c.x - a.x, fy = c.y - a.y;
  var t = (fx * dy2 - fy * dx2) / cross;
  var u = (fx * dy1 - fy * dx1) / cross;
  if (t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS) {
    return { point: { x: a.x + t * dx1, y: a.y + t * dy1 }, tA: t, tB: u };
  }
  return null;
}

// Fix self-intersections in the inner polygon.
//
// Pipeline:
// 1) Merge consecutive coincident inner vertices into "groups" so every
//    edge in the compressed polygon has nonzero length.
// 2) For each group, check the effective left edge (prev-group → this-group)
//    and right edge (this-group → next-group) for crossings with any
//    non-adjacent edge of the compressed polygon.
// 3) Apply:
//      • Both cross  → first half of the group's outer-indices snapped to
//        the left crossing point, second half to the right crossing point.
//        For a single-vertex group this spawns an extra inner vertex
//        (creating a new bevel face).
//      • One crosses  → whole group snapped to that crossing point.
//      • None crosses → keep original position.
// 4) Expand back: every original outer vertex gets exactly one inner vertex
//    and an entry in outerMap for its connector.
function fixSelfIntersections(inner, outer) {
  var n = inner.length;
  var DIST_SQ = 0.25; // threshold for "same position"

  // --- Step 1: build groups of consecutive coincident vertices ---
  var groups = []; // { x, y, indices[] }
  for (var i = 0; i < n; i++) {
    if (groups.length > 0) {
      var last = groups[groups.length - 1];
      var dx = inner[i].x - last.x, dy = inner[i].y - last.y;
      if (dx * dx + dy * dy < DIST_SQ) {
        last.indices.push(i);
        continue;
      }
    }
    groups.push({ x: inner[i].x, y: inner[i].y, indices: [i] });
  }
  // Wrap-around: merge last into first if same position
  if (groups.length > 1) {
    var first = groups[0], last = groups[groups.length - 1];
    var dx = first.x - last.x, dy = first.y - last.y;
    if (dx * dx + dy * dy < DIST_SQ) {
      first.indices = last.indices.concat(first.indices);
      first.x = last.x; first.y = last.y;
      groups.pop();
    }
  }

  var gn = groups.length;
  if (gn < 3) {
    // Degenerate — nothing to fix
    var res = [], map = [];
    for (var i = 0; i < n; i++) { res.push({ x: inner[i].x, y: inner[i].y }); map.push(i); }
    return { inner: res, outerMap: map };
  }

  // --- Step 2: detect crossings on the compressed polygon ---
  for (var gi = 0; gi < gn; gi++) {
    var prevGI = (gi - 1 + gn) % gn;
    var nextGI = (gi + 1) % gn;
    var A = groups[prevGI], B = groups[gi], C = groups[nextGI];

    // Left edge: A → B  (vertex B at t = 1; want highest tA)
    var leftHit = null;
    for (var gj = 0; gj < gn; gj++) {
      if (gj === (prevGI - 1 + gn) % gn || gj === prevGI || gj === gi) continue;
      var gj2 = (gj + 1) % gn;
      var h = segSegIntersect(A, B, groups[gj], groups[gj2]);
      if (h && (!leftHit || h.tA > leftHit.tA)) leftHit = h;
    }

    // Right edge: B → C  (vertex B at t = 0; want lowest tA)
    var rightHit = null;
    for (var gj = 0; gj < gn; gj++) {
      if (gj === prevGI || gj === gi || gj === nextGI) continue;
      var gj2 = (gj + 1) % gn;
      var h = segSegIntersect(B, C, groups[gj], groups[gj2]);
      if (h && (!rightHit || h.tA < rightHit.tA)) rightHit = h;
    }

    groups[gi].leftHit = leftHit;
    groups[gi].rightHit = rightHit;
  }

  // --- Step 3 + 4: expand back into newInner / outerMap ---
  var newInner = [];
  var outerMap = [];

  for (var gi = 0; gi < gn; gi++) {
    var g = groups[gi];
    var lh = g.leftHit, rh = g.rightHit;
    var idx = g.indices;

    if (lh && rh) {
      if (idx.length === 1) {
        // Single vertex: spawn two (creates new bevel face)
        newInner.push({ x: lh.point.x, y: lh.point.y });
        outerMap.push(idx[0]);
        newInner.push({ x: rh.point.x, y: rh.point.y });
        outerMap.push(idx[0]);
      } else {
        // Collapsed group: first half → left hit, second half → right hit
        var half = Math.ceil(idx.length / 2);
        for (var k = 0; k < half; k++) {
          newInner.push({ x: lh.point.x, y: lh.point.y });
          outerMap.push(idx[k]);
        }
        for (var k = half; k < idx.length; k++) {
          newInner.push({ x: rh.point.x, y: rh.point.y });
          outerMap.push(idx[k]);
        }
      }
    } else if (lh) {
      for (var k = 0; k < idx.length; k++) {
        newInner.push({ x: lh.point.x, y: lh.point.y });
        outerMap.push(idx[k]);
      }
    } else if (rh) {
      for (var k = 0; k < idx.length; k++) {
        newInner.push({ x: rh.point.x, y: rh.point.y });
        outerMap.push(idx[k]);
      }
    } else {
      for (var k = 0; k < idx.length; k++) {
        newInner.push({ x: g.x, y: g.y });
        outerMap.push(idx[k]);
      }
    }
  }

  return { inner: newInner, outerMap: outerMap };
}

// --------------- post-process: eliminate all remaining crossings ---------------
//
// Three phases per iteration (up to MAX_ITER passes):
//   Phase 0 – inner-edge vs inner-edge: snap the two forward-endpoints of
//             crossing edge pairs to their intersection (pinch).
//   Phase 1 – connector vs inner-edge: find the first inner edge each
//             connector crosses and shorten the connector to just before it.
//   Phase 2 – connector vs connector: shorten whichever connector's crossing
//             point is nearer its inner endpoint.
//
// Every phase only *shortens* segments (moves inner vertices toward their
// outer counterpart or toward a crossing point), so the process converges.

function postProcessBevel(inner, outerMap, outer) {
  var m = inner.length;
  var MAX_ITER = 5;

  for (var iter = 0; iter < MAX_ITER; iter++) {
    var changed = false;

    // ---- Phase 0: inner-edge self-intersections ----
    for (var i = 0; i < m; i++) {
      var i2 = (i + 1) % m;
      var ex = inner[i2].x - inner[i].x, ey = inner[i2].y - inner[i].y;
      if (ex * ex + ey * ey < 0.01) continue;
      for (var j = i + 2; j < m; j++) {
        if (i === 0 && j === m - 1) continue; // adjacent (wrap)
        var j2 = (j + 1) % m;
        var fx = inner[j2].x - inner[j].x, fy = inner[j2].y - inner[j].y;
        if (fx * fx + fy * fy < 0.01) continue;
        var h = segSegIntersect(inner[i], inner[i2], inner[j], inner[j2]);
        if (h) {
          // Pinch: snap the two "inner" endpoints to the crossing point
          inner[i2] = { x: h.point.x, y: h.point.y };
          inner[j]  = { x: h.point.x, y: h.point.y };
          changed = true;
        }
      }
    }

    // ---- Phase 1: clip connectors against inner edges ----
    for (var i = 0; i < m; i++) {
      var oi = outerMap[i];
      var ox = outer[oi].x, oy = outer[oi].y;
      var ix = inner[i].x, iy = inner[i].y;
      var cdx = ix - ox, cdy = iy - oy;
      if (cdx * cdx + cdy * cdy < 0.01) continue;

      var bestT = 1.0;
      for (var j = 0; j < m; j++) {
        var j2 = (j + 1) % m;
        // skip edges adjacent to this inner vertex
        if (j === i || j === (i - 1 + m) % m) continue;
        var ex = inner[j2].x - inner[j].x, ey = inner[j2].y - inner[j].y;
        if (ex * ex + ey * ey < 0.01) continue;
        var h = segSegIntersect({x: ox, y: oy}, {x: ix, y: iy}, inner[j], inner[j2]);
        if (h && h.tA < bestT) bestT = h.tA;
      }

      if (bestT < 0.999) {
        var t = bestT * 0.95; // slightly back toward outer vertex
        inner[i] = { x: ox + t * cdx, y: oy + t * cdy };
        changed = true;
      }
    }

    // ---- Phase 2: connector–connector crossings ----
    for (var i = 0; i < m; i++) {
      for (var j = i + 1; j < m; j++) {
        var oiA = outerMap[i], oiB = outerMap[j];
        if (oiA === oiB) continue; // same outer vertex — no crossing
        var h = segSegIntersect(outer[oiA], inner[i], outer[oiB], inner[j]);
        if (h) {
          // Shorten the connector whose crossing is nearer its inner end
          if (h.tA >= h.tB) {
            var t = h.tA * 0.95;
            var dx = inner[i].x - outer[oiA].x, dy = inner[i].y - outer[oiA].y;
            inner[i] = { x: outer[oiA].x + t * dx, y: outer[oiA].y + t * dy };
          } else {
            var t = h.tB * 0.95;
            var dx = inner[j].x - outer[oiB].x, dy = inner[j].y - outer[oiB].y;
            inner[j] = { x: outer[oiB].x + t * dx, y: outer[oiB].y + t * dy };
          }
          changed = true;
        }
      }
    }

    if (!changed) break;
  }
}
