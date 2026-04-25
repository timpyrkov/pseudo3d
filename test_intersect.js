let seed = 42;
let numVertices = 30;
let noiseStrength = 0.5;
let animSpeed = 1.0;
let playing = true;
let animOffset = 0;
let zoom = 1.0;

const W = 400;
const H = 400;
const BASE_RADIUS = Math.min(W, H) / 3;

const PALETTE = [
  [70, 130, 180], [210, 110, 80], [100, 170, 100],
  [200, 180, 80], [180, 100, 200], [80, 180, 200],
  [220, 140, 140], [140, 200, 160], [160, 160, 210],
];

function getSlider(id) { return document.getElementById(id); }
function setVal(id, val) { document.getElementById(id).textContent = val; }

new p5(function (p) {
  p.setup = function () {
    const cnv = p.createCanvas(W, H);
    cnv.parent('canvas-container');
    p.colorMode(p.RGB, 255, 255, 255, 255);

    getSlider('slider-seed').addEventListener('input', function () {
      seed = parseInt(this.value); setVal('val-seed', seed);
    });
    getSlider('slider-vertices').addEventListener('input', function () {
      numVertices = parseInt(this.value); setVal('val-vertices', numVertices);
    });
    getSlider('slider-noise').addEventListener('input', function () {
      noiseStrength = parseFloat(this.value); setVal('val-noise', noiseStrength.toFixed(2));
    });
    getSlider('slider-zoom').addEventListener('input', function () {
      zoom = parseFloat(this.value); setVal('val-zoom', zoom.toFixed(2));
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
    if (playing) animOffset += 0.005 * animSpeed;

    p.background(20, 20, 28);
    p.translate(W / 2, H / 2);
    p.scale(zoom);
    p.translate(-W / 2, -H / 2);

    const verts = buildShape(p, seed, numVertices, noiseStrength, animOffset);
    const n = verts.length;

    // --- Detect & resolve self-intersections ---
    const intersections = findIntersections(verts);
    const loops = untangle(verts, intersections);

    // --- Fill each resolved sub-polygon ---
    p.noStroke();
    for (let i = 0; i < loops.length; i++) {
      const c = PALETTE[i % PALETTE.length];
      p.fill(c[0], c[1], c[2]);
      p.beginShape();
      for (const v of loops[i]) p.vertex(v.x, v.y);
      p.endShape(p.CLOSE);
    }

    // --- Original polygon outline ---
    p.stroke(255);
    p.strokeWeight(1.5);
    p.noFill();
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      p.line(verts[i].x, verts[i].y, verts[j].x, verts[j].y);
    }

    // --- Intersection points (red) ---
    p.noStroke();
    p.fill(255, 70, 70);
    for (const isect of intersections) {
      p.circle(isect.point.x, isect.point.y, 7);
    }

    // --- Original vertices (white) ---
    p.fill(255);
    for (const v of verts) p.circle(v.x, v.y, 5);
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
    const nx = p.cos(angle) * 1.5 + 2;
    const ny = p.sin(angle) * 1.5 + 2;
    const nVal = p.noise(nx + timeOffset, ny + timeOffset);
    const distortion = p.map(nVal, 0, 1, 1 - noiseStr, 1 + noiseStr);
    const r = BASE_RADIUS * distortion;
    verts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return verts;
}

// --------------- self-intersection detection ---------------

// Segment-segment intersection.
// Returns { point, tA, tB } if the open segments cross, else null.
function segSegIntersect(a, b, c, d) {
  const EPS = 1e-9;
  const dx1 = b.x - a.x, dy1 = b.y - a.y;
  const dx2 = d.x - c.x, dy2 = d.y - c.y;
  const cross = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(cross) < EPS) return null; // parallel / collinear
  const fx = c.x - a.x, fy = c.y - a.y;
  const t = (fx * dy2 - fy * dx2) / cross;
  const u = (fx * dy1 - fy * dx1) / cross;
  if (t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS) {
    return { point: { x: a.x + t * dx1, y: a.y + t * dy1 }, tA: t, tB: u };
  }
  return null;
}

// Brute-force O(n^2): every non-adjacent edge pair.
function findIntersections(verts) {
  const n = verts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      // Skip the edge pair that shares vertex 0 (edges n-1 and 0)
      if (i === 0 && j === n - 1) continue;
      const j2 = (j + 1) % n;
      const hit = segSegIntersect(verts[i], verts[i2], verts[j], verts[j2]);
      if (hit) {
        out.push({ point: hit.point, edgeA: i, edgeB: j, tA: hit.tA, tB: hit.tB });
      }
    }
  }
  return out;
}

// --------------- self-intersection resolution ---------------

// "Swap-at-intersection" untangling:
// 1) Insert each intersection twice into the traversal sequence
//    (once on each crossing edge, in order of parameter t).
// 2) Build twin links between the two occurrences.
// 3) Walk the sequence; at each intersection, jump to its twin
//    before advancing. Each walk extracts one simple loop.
// 4) Repeat from any unvisited position until every position is consumed.
function untangle(verts, intersections) {
  const n = verts.length;
  if (intersections.length === 0) {
    return [verts.map(v => ({ x: v.x, y: v.y }))];
  }

  // Group intersections per edge, sorted by parameter along that edge.
  const byEdge = Array.from({ length: n }, () => []);
  for (let k = 0; k < intersections.length; k++) {
    byEdge[intersections[k].edgeA].push({ t: intersections[k].tA, xi: k });
    byEdge[intersections[k].edgeB].push({ t: intersections[k].tB, xi: k });
  }
  for (let i = 0; i < n; i++) byEdge[i].sort((a, b) => a.t - b.t);

  // Build expanded sequence: vertex, then all intersections on the outgoing edge.
  const seq = [];
  const occurrences = new Map(); // xi -> [pos, pos]
  for (let i = 0; i < n; i++) {
    seq.push({ kind: 'v', vi: i });
    for (const { xi } of byEdge[i]) {
      const pos = seq.length;
      seq.push({ kind: 'x', xi });
      if (!occurrences.has(xi)) occurrences.set(xi, []);
      occurrences.get(xi).push(pos);
    }
  }

  // Twin links
  const twin = new Array(seq.length).fill(-1);
  for (const [, positions] of occurrences) {
    if (positions.length === 2) {
      twin[positions[0]] = positions[1];
      twin[positions[1]] = positions[0];
    }
  }

  const getPoint = (pos) => {
    const s = seq[pos];
    return s.kind === 'v' ? verts[s.vi] : intersections[s.xi].point;
  };

  const loops = [];
  const visited = new Array(seq.length).fill(false);

  for (let start = 0; start < seq.length; start++) {
    if (visited[start]) continue;
    const loop = [];
    let pos = start;
    // Guard against pathological infinite loops
    let safety = seq.length * 2;
    while (!visited[pos] && safety-- > 0) {
      visited[pos] = true;
      loop.push(getPoint(pos));
      // Advance: at an intersection, swap to twin first
      let next = (pos + 1) % seq.length;
      if (seq[pos].kind === 'x' && twin[pos] >= 0) {
        next = (twin[pos] + 1) % seq.length;
      }
      pos = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }

  return loops;
}
