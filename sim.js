// A 2D toy of what GranumFL does, small enough to run in a browser: a column of grains
// saturated with water is held behind a gate; the gate lifts and the debris runs down a slope
// into a box. The water is solved with double-density relaxation (Clavet et al. 2005), the
// grains with non-overlap contacts and friction, and the two are coupled by a drag that pulls
// each grain's velocity toward the local water velocity (with the opposite impulse on the
// water) and by buoyancy. Illustrative only: the program itself is 3D WCSPH-DEM on a GPU.
(function (root) {
  "use strict";

  function Sim(opts) {
    opts = opts || {};
    this.W = 200;           // domain width (units)
    this.H = 90;            // domain height
    this.slope = opts.slope != null ? opts.slope : 0.12; // floor rise from right to left over W
    this.reset();
  }

  // floor height at x: rises toward the left (the source), flat near the right end
  Sim.prototype.floor = function (x) {
    return Math.max(0, (this.W * 0.72 - x)) * this.slope;
  };

  Sim.prototype.reset = function () {
    var W = this.W, H = this.H;
    this.t = 0;
    this.gateX = 34; this.gateY = 0; this.gateUp = false;
    this.box = { x0: 152, x1: 160, y0: 0, y1: 11 };
    // water: a lattice in the reservoir, above and among the grains
    var wx = [], wy = [], gx = [], gy = [];
    var s = 1.4;
    for (var y = this.floor(2) + 0.8; y < 58; y += s) {
      for (var x = 1.2; x < this.gateX - 1.2; x += s) {
        if (y > this.floor(x) + 0.8) { wx.push(x + (Math.random() - 0.5) * 0.2); wy.push(y); }
      }
    }
    // grains: a loose pile in the lower part of the reservoir
    var gs = 1.95;
    for (y = this.floor(2) + 1.1; y < 40; y += gs) {
      for (x = 2 + (Math.round(y / gs) % 2) * gs * 0.5; x < this.gateX - 2; x += gs) {
        if (y > this.floor(x) + 1.0) { gx.push(x + (Math.random() - 0.5) * 0.3); gy.push(y); }
      }
    }
    this.nw = wx.length; this.ng = gx.length;
    this.wx = Float32Array.from(wx); this.wy = Float32Array.from(wy);
    this.wvx = new Float32Array(this.nw); this.wvy = new Float32Array(this.nw);
    this.wpx = new Float32Array(this.nw); this.wpy = new Float32Array(this.nw);
    this.gx = Float32Array.from(gx); this.gy = Float32Array.from(gy);
    this.gvx = new Float32Array(this.ng); this.gvy = new Float32Array(this.ng);
    this.gpx = new Float32Array(this.ng); this.gpy = new Float32Array(this.ng);
    this.gr = new Float32Array(this.ng);
    for (var i = 0; i < this.ng; i++) this.gr[i] = 0.72 + Math.random() * 0.26;
    this.wspeed = new Float32Array(this.nw); this.gspeed = new Float32Array(this.ng);
    // parameters (frame units, dt = 1)
    this.h = 3.5;           // water interaction radius (2.5 lattice spacings)
    this.rho0 = 4.5; this.k = 0.06; this.kNear = 0.24;
    this.g = 0.022;         // gravity per step²
    this.drag = 0.18;       // grain velocity relaxation toward the water
    this.buoy = 0.62;       // share of gravity left for a submerged grain (1 - ρw/ρs)
    this.cell = 3.5;
    this.gw = Math.ceil(W / this.cell) + 1; this.gh = Math.ceil((H + 40) / this.cell) + 1;
  };

  // a uniform grid of particle indices (water and grains share it: grains get offset ids)
  Sim.prototype.bin = function () {
    var n = this.nw + this.ng, c = this.cell, gw = this.gw, gh = this.gh;
    if (!this.head || this.head.length !== gw * gh) { this.head = new Int32Array(gw * gh); }
    if (!this.next || this.next.length !== n) { this.next = new Int32Array(n); }
    this.head.fill(-1);
    for (var i = 0; i < n; i++) {
      var x = i < this.nw ? this.wx[i] : this.gx[i - this.nw];
      var y = i < this.nw ? this.wy[i] : this.gy[i - this.nw];
      var cx = Math.min(gw - 1, Math.max(0, (x / c) | 0)), cy = Math.min(gh - 1, Math.max(0, (y / c) | 0));
      var k = cy * gw + cx;
      this.next[i] = this.head[k]; this.head[k] = i;
    }
  };

  Sim.prototype.each = function (x, y, f) {
    var c = this.cell, gw = this.gw, gh = this.gh;
    var cx = (x / c) | 0, cy = (y / c) | 0;
    for (var dy = -1; dy <= 1; dy++) {
      var yy = cy + dy; if (yy < 0 || yy >= gh) continue;
      for (var dx = -1; dx <= 1; dx++) {
        var xx = cx + dx; if (xx < 0 || xx >= gw) continue;
        for (var j = this.head[yy * gw + xx]; j >= 0; j = this.next[j]) f(j);
      }
    }
  };

  // walls, floor, gate and box push a point (radius r) back inside; returns the new position
  Sim.prototype.collide = function (x, y, r, vx, vy, out) {
    var W = this.W;
    if (x < r) x = r; if (x > W - r) x = W - r;
    var fy = this.floor(x) + r;
    if (y < fy) y = fy;
    if (y > this.H + 30) y = this.H + 30;
    // the gate (until it has lifted above the debris)
    if (y < this.gateY + 60 && y > this.gateY && Math.abs(x - this.gateX) < r + 0.6) x = x < this.gateX ? this.gateX - r - 0.6 : this.gateX + r + 0.6;
    // the box
    var b = this.box;
    if (x > b.x0 - r && x < b.x1 + r && y < b.y1 + r) {
      var dl = x - (b.x0 - r), dr = (b.x1 + r) - x, dt = (b.y1 + r) - y;
      if (dt < dl && dt < dr) y = b.y1 + r; else if (dl < dr) x = b.x0 - r; else x = b.x1 + r;
    }
    out[0] = x; out[1] = y;
  };

  Sim.prototype.step = function () {
    var nw = this.nw, ng = this.ng, i, j, o = [0, 0];
    var gx = Math.sin(0) * this.g, gy = -this.g;
    this.t += 1 / 60;
    if (!this.gateUp && this.t > 1.2) this.gateUp = true;
    if (this.gateUp) this.gateY = Math.min(200, this.gateY + 1.6);
    // 1. gravity, then predict
    for (i = 0; i < nw; i++) {
      this.wvy[i] += gy; this.wvx[i] += gx;
      this.wpx[i] = this.wx[i]; this.wpy[i] = this.wy[i];
      this.wx[i] += this.wvx[i]; this.wy[i] += this.wvy[i];
    }
    this.bin();
    // 2. coupling: each grain feels the local water velocity (drag) and buoyancy
    var self = this;
    for (i = 0; i < ng; i++) {
      var px = this.gx[i], py = this.gy[i], su = 0, sv = 0, sw = 0, nb = 0;
      this.each(px, py, function (j) {
        if (j >= nw) return;
        var dx = self.wx[j] - px, dy = self.wy[j] - py, r2 = dx * dx + dy * dy;
        if (r2 < self.h * self.h) {
          var w = 1 - Math.sqrt(r2) / self.h;
          su += w * self.wvx[j]; sv += w * self.wvy[j]; sw += w; nb++;
        }
      });
      var sub = nb > 3;
      this.gvy[i] += gy * (sub ? this.buoy : 1); this.gvx[i] += gx * (sub ? this.buoy : 1);
      if (sw > 0) {
        var ux = su / sw, uy = sv / sw;
        var dvx = this.drag * (ux - this.gvx[i]), dvy = this.drag * (uy - this.gvy[i]);
        this.gvx[i] += dvx; this.gvy[i] += dvy;
        // the opposite impulse on the water nearby (grain mass ≈ 2.6 water particles)
        var share = 2.6 / Math.max(nb, 1);
        this.each(px, py, function (j) {
          if (j >= nw) return;
          var dx = self.wx[j] - px, dy = self.wy[j] - py;
          if (dx * dx + dy * dy < self.h * self.h) { self.wx[j] -= dvx * share; self.wy[j] -= dvy * share; }
        });
      }
      this.gpx[i] = this.gx[i]; this.gpy[i] = this.gy[i];
      this.gx[i] += this.gvx[i]; this.gy[i] += this.gvy[i];
    }
    this.bin();
    // 3. water: double-density relaxation (grains count in the density, so water is pushed out
    // of a pile as the porosity falls)
    var h = this.h, h2 = h * h, rho0 = this.rho0, k = this.k, kn = this.kNear;
    for (i = 0; i < nw; i++) {
      var xi = this.wx[i], yi = this.wy[i], rho = 0, rhon = 0;
      var list = [];
      this.each(xi, yi, function (j) {
        if (j === i) return;
        var xj = j < nw ? self.wx[j] : self.gx[j - nw], yj = j < nw ? self.wy[j] : self.gy[j - nw];
        var dx = xj - xi, dy = yj - yi, r2 = dx * dx + dy * dy;
        if (r2 < h2 && r2 > 1e-9) {
          var r = Math.sqrt(r2), q = 1 - r / h, m = j < nw ? 1 : 1.6;
          rho += m * q * q; rhon += m * q * q * q;
          list.push(j, dx / r, dy / r, q);
        }
      });
      var P = k * (rho - rho0), Pn = kn * rhon, ax = 0, ay = 0;
      for (var l = 0; l < list.length; l += 4) {
        j = list[l]; var q2 = list[l + 3];
        var D = (P * q2 + Pn * q2 * q2) * 0.5;
        var ddx = D * list[l + 1], ddy = D * list[l + 2];
        if (j < nw) { this.wx[j] += ddx; this.wy[j] += ddy; } else { this.gx[j - nw] += ddx * 0.25; this.gy[j - nw] += ddy * 0.25; }
        ax -= ddx; ay -= ddy;
      }
      this.wx[i] += ax; this.wy[i] += ay;
    }
    // 4. grains: non-overlap contacts with friction (a few relaxation sweeps)
    for (var it = 0; it < 3; it++) {
      this.bin();
      for (i = 0; i < ng; i++) {
        var xi2 = this.gx[i], yi2 = this.gy[i], ri = this.gr[i];
        this.each(xi2, yi2, function (jj) {
          if (jj < nw) return;
          j = jj - nw; if (j <= i) return;
          var dx = self.gx[j] - self.gx[i], dy = self.gy[j] - self.gy[i], r2 = dx * dx + dy * dy, rr = ri + self.gr[j];
          if (r2 < rr * rr && r2 > 1e-9) {
            var r = Math.sqrt(r2), pen = (rr - r) * 0.5, nx = dx / r, ny = dy / r;
            self.gx[i] -= nx * pen; self.gy[i] -= ny * pen; self.gx[j] += nx * pen; self.gy[j] += ny * pen;
            // friction: remove part of the relative tangential motion of this step
            var tvx = (self.gx[j] - self.gpx[j]) - (self.gx[i] - self.gpx[i]), tvy = (self.gy[j] - self.gpy[j]) - (self.gy[i] - self.gpy[i]);
            var tn = tvx * nx + tvy * ny; tvx -= tn * nx; tvy -= tn * ny;
            var f = 0.12;
            self.gx[i] += tvx * f; self.gy[i] += tvy * f; self.gx[j] -= tvx * f; self.gy[j] -= tvy * f;
          }
        });
      }
    }
    // 5. boundaries and velocities
    for (i = 0; i < nw; i++) {
      this.collide(this.wx[i], this.wy[i], 0.6, 0, 0, o);
      this.wx[i] = o[0]; this.wy[i] = o[1];
      var vx = this.wx[i] - this.wpx[i], vy = this.wy[i] - this.wpy[i];
      var sp = Math.sqrt(vx * vx + vy * vy);
      if (sp > 3) { vx *= 3 / sp; vy *= 3 / sp; sp = 3; }
      this.wvx[i] = vx * 0.995; this.wvy[i] = vy * 0.995; this.wspeed[i] = sp;
    }
    for (i = 0; i < ng; i++) {
      this.collide(this.gx[i], this.gy[i], this.gr[i], 0, 0, o);
      // a grain on the floor or the box loses some of its slide (basal friction)
      var onFloor = o[1] <= this.floor(o[0]) + this.gr[i] + 0.05;
      this.gx[i] = o[0]; this.gy[i] = o[1];
      var gvx = this.gx[i] - this.gpx[i], gvy = this.gy[i] - this.gpy[i];
      if (onFloor) gvx *= 0.9;
      var gsp = Math.sqrt(gvx * gvx + gvy * gvy);
      if (gsp > 3) { gvx *= 3 / gsp; gvy *= 3 / gsp; gsp = 3; }
      this.gvx[i] = gvx; this.gvy[i] = gvy; this.gspeed[i] = gsp;
    }
  };

  // simple measures for the overlay: the grain front and the water front (95th percentile x)
  Sim.prototype.fronts = function () {
    function p95(a, n) { var b = Array.prototype.slice.call(a, 0, n).sort(function (u, v) { return u - v; }); return b[Math.floor(0.95 * (n - 1))] || 0; }
    return { grains: p95(this.gx, this.ng), water: p95(this.wx, this.nw) };
  };

  if (typeof module !== "undefined") module.exports = Sim; else root.GranumFLSim = Sim;
})(this);
