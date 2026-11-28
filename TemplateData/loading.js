// うしもうもう loading screen: one of the farm's cows walks along the farm road to the barn while the game
// downloads. UshiLoading.set(0..1) moves her, done() fades the screen out, fail(text) shows a note.
(function () {
  var INK = [0x4a, 0x33, 0x20];
  // Calf_Walk.png is 512px with the lines black on transparent: paint her white with black
  // patches, and the lines in the game's ink brown (ArtInk does the same inside Unity).
  var PATCHES = [
    { x: 268, y: 214, r: 44 }, { x: 345, y: 196, r: 30 }, { x: 352, y: 272, r: 30 },
    { x: 200, y: 318, r: 20 }, { x: 150, y: 196, r: 18 },
  ];

  function paintCalf(img) {
    var s = img.naturalWidth, h = img.naturalHeight;
    var c = document.createElement("canvas");
    c.width = s; c.height = h;
    var g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    var data = g.getImageData(0, 0, s, h), px = data.data, n = s * h;

    // Walls: the lines, grown by 2px so small gaps in the pen line don't let the outside in.
    // How much pen each pixel has (the inside of the drawing is opaque white, not empty).
    var pen = new Float32Array(n), line = new Uint8Array(n), wall = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      var lum = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 765;
      pen[i] = (px[i * 4 + 3] / 255) * (1 - lum);
      line[i] = pen[i] > 0.3 ? 1 : 0;
    }
    for (var y = 0; y < h; y++) for (var x = 0; x < s; x++) {
      if (!line[y * s + x]) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
        var xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < s && yy < h) wall[yy * s + xx] = 1;
      }
    }
    // Outside = reachable from the border without crossing a wall.
    var out = new Uint8Array(n), stack = [];
    for (x = 0; x < s; x++) { stack.push(x, (h - 1) * s + x); }
    for (y = 0; y < h; y++) { stack.push(y * s, y * s + s - 1); }
    while (stack.length) {
      var p = stack.pop();
      if (out[p] || wall[p]) continue;
      out[p] = 1;
      var px0 = p % s;
      if (px0 > 0) stack.push(p - 1);
      if (px0 < s - 1) stack.push(p + 1);
      if (p >= s) stack.push(p - s);
      if (p < n - s) stack.push(p + s);
    }
    // Grow the outside back by the 2px the walls were grown, so the white meets the lines.
    var outside = new Uint8Array(out);
    for (var k = 0; k < 2; k++) {
      var next = new Uint8Array(outside);
      for (p = 0; p < n; p++) {
        if (outside[p] || line[p]) continue;
        var x0 = p % s;
        if ((x0 > 0 && outside[p - 1]) || (x0 < s - 1 && outside[p + 1]) ||
            (p >= s && outside[p - s]) || (p < n - s && outside[p + s])) next[p] = 1;
      }
      outside = next;
    }

    for (p = 0; p < n; p++) {
      var o = p * 4, a = pen[p];
      if (outside[p]) {
        // Keep the anti-aliased edge: only the pen part shows outside.
        px[o] = INK[0]; px[o + 1] = INK[1]; px[o + 2] = INK[2]; px[o + 3] = 255 * a;
        continue;
      }
      var x1 = p % s, y1 = (p / s) | 0, black = false;
      for (var j = 0; j < PATCHES.length; j++) {
        var q = PATCHES[j], ddx = x1 - q.x, ddy = y1 - q.y;
        // A little wobble so the patches aren't plain circles.
        var r = q.r * (1 + 0.18 * Math.sin(Math.atan2(ddy, ddx) * 3 + j));
        if (ddx * ddx + ddy * ddy < r * r) { black = true; break; }
      }
      var fill = black ? [0x2b, 0x26, 0x24] : [0xff, 0xff, 0xff];
      // Lines over the fill.
      px[o] = INK[0] * a + fill[0] * (1 - a);
      px[o + 1] = INK[1] * a + fill[1] * (1 - a);
      px[o + 2] = INK[2] * a + fill[2] * (1 - a);
      px[o + 3] = 255;
    }
    g.putImageData(data, 0, 0);
    // Cropped to her, like the farm's own pictures (LoadingCows.Paint), so her feet are its bottom.
    var x0 = s, y0 = h, x1 = -1, y1 = -1;
    for (p = 0; p < n; p++) {
      if (px[p * 4 + 3] < 8) continue;
      var cx = p % s, cy = (p / s) | 0;
      if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
    }
    var out = document.createElement("canvas");
    out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext("2d").drawImage(c, -x0, -y0);
    return { pic: out, w: out.width / s };
  }

  // One of the farm's own cows, left by the game on an earlier visit (LoadingCows), or null.
  function storedCow() {
    try {
      var list = JSON.parse(window.localStorage.getItem("ushimowmow.loadingCows") || "[]");
      if (!list.length) return null;
      return list[Math.floor(Math.random() * list.length)];
    } catch (e) { return null; }
  }

  // A calf's drawing is shown smaller than an older cow's (LoadingCows.StageScale).
  var CALF_SCALE = 0.79;
  // Her width at w = 1: a whole drawing's width, as cqw of the screen.
  var DRAWING_WIDTH = 26;

  function show(pic, w) {
    cow.style.width = (DRAWING_WIDTH * w) + "cqw";
    var shadow = document.createElement("div");
    shadow.className = "shadow";
    var bob = document.createElement("div");
    bob.className = "bob";
    bob.appendChild(pic);
    cow.appendChild(shadow);
    cow.appendChild(bob);
  }

  var cow, trail, pct, shown = 0, target = 0, finished = false;
  var START = 78, END = 29; // her centre, % of the width: from the right to the barn door

  function frame() {
    // Glide towards the reported progress, and creep a little while Unity is quiet so she
    // never looks stuck (but never past what has actually loaded + a bit).
    shown += (target - shown) * 0.06;
    if (!finished && shown < Math.min(0.97, target + 0.04)) shown += 0.0006;
    var t = Math.min(1, shown), x = START + (END - START) * t;
    cow.style.left = x + "%";
    trail.style.width = (100 - x) + "%";
    pct.textContent = Math.floor(t * 100) + "%";
    if (!finished || shown < 0.999) requestAnimationFrame(frame);
  }

  // ---- The sky at this hour: FarmSky's key colors through the local day, blended smoothly, and
  // laid on like FarmOverviewScreen.BuildSky / BuildLand / FarmScenery do.
  function hex(s) { return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
  function make(top, bottom, far, near, ground, light, dark) {
    return { top: hex(top), bottom: hex(bottom), far: hex(far), near: hex(near), ground: hex(ground), light: hex(light), dark: dark };
  }
  var NIGHT = make("1B2340", "33406B", "34485A", "3A5644", "4A6646", "7F8FC0", 1);
  var DAWN = make("8FB4DC", "F9C9A0", "A3BFA0", "8DB872", "A2C878", "FFE6CC", 0.25);
  var DAY = make("8CC8EE", "D6EEF8", "A8CFA0", "8DC072", "A9D27C", "FFFFFF", 0);
  var DUSK = make("6E7FB8", "F5A878", "8E9E86", "7E9E62", "94B068", "F2CCAE", 0.35);
  var EVENING = make("2A3260", "6B5A8A", "4A5468", "4A6450", "58744E", "9A9CC8", 0.8);
  var KEYS = [[0, NIGHT], [4.5, NIGHT], [6, DAWN], [8, DAY], [16, DAY], [18, DUSK], [19.5, EVENING], [21, NIGHT], [24, NIGHT]];
  var SUNRISE = 5, SUNSET = 19.5;

  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, alpha) {
    var r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
    return alpha === undefined ? "rgb(" + r + "," + g + "," + b + ")" : "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }
  function paletteAt(hour) {
    for (var i = 0; i < KEYS.length - 1; i++) {
      var from = KEYS[i], to = KEYS[i + 1];
      if (hour > to[0]) continue;
      var t = (hour - from[0]) / (to[0] - from[0]);
      t = t * t * (3 - 2 * t);
      var a = from[1], b = to[1], p = {};
      ["top", "bottom", "far", "near", "ground", "light"].forEach(function (k) { p[k] = mix(a[k], b[k], t); });
      p.dark = a.dark + (b.dark - a.dark) * t;
      return p;
    }
    return NIGHT;
  }
  function arcProgress(hour) {
    if (hour >= SUNRISE && hour < SUNSET) return (hour - SUNRISE) / (SUNSET - SUNRISE);
    var since = hour >= SUNSET ? hour - SUNSET : hour + 24 - SUNSET;
    return since / (24 - (SUNSET - SUNRISE));
  }

  function paintSky(hour) {
    var root = document.getElementById("loading"), p = paletteAt(hour), d = p.dark;
    document.getElementById("stars").innerHTML = "";
    root.style.removeProperty("--status");
    var set = function (k, v) { root.style.setProperty(k, v); };
    set("--sky-top", rgb(p.top));
    set("--sky-bottom", rgb(p.bottom));
    set("--hills-far", rgb(p.far));
    set("--hills-near", rgb(p.near));
    set("--ground", rgb(p.ground));
    set("--ground-front", rgb(mix(p.ground, [0, 0, 0], 0.09)));
    set("--meadow", rgb(mix(p.ground, [46, 92, 41], 0.12)));
    set("--haze", rgb(p.bottom, 0.28));
    set("--wood", rgb(mix(p.light, p.near, 0.72), 0.7));
    var cloud = mix([255, 255, 255], p.light, 0.8);
    set("--cloud", rgb(cloud));
    set("--cloud-alpha", (0.95 + (0.35 - 0.95) * d).toFixed(3));
    set("--shadow", "rgba(51,31,13," + (0.22 * (1 - 0.45 * d)).toFixed(3) + ")");
    set("--lights", Math.min(1, d * 1.2).toFixed(3));
    if (d >= 0.5) set("--status", "#f4ecd8");
    // Everything on the ground in the sky's light.
    var l = p.light.map(function (v) { return (v / 255).toFixed(3); });
    document.getElementById("light-matrix").setAttribute("values",
      l[0] + " 0 0 0 0  0 " + l[1] + " 0 0 0  0 0 " + l[2] + " 0 0  0 0 0 1 0");

    // Sun or moon along its arc, over the sky (which ends just above the horizon).
    var prog = arcProgress(hour), skyH = 59; // cqh: 100 - (horizon 43 - 2)
    var x = 10 + 80 * prog, yUp = 0.2 + 0.6 * Math.sin(Math.PI * prog);
    var up = hour >= SUNRISE && hour < SUNSET;
    var body = document.getElementById(up ? "sun" : "moon");
    document.getElementById(up ? "moon" : "sun").style.display = "none";
    body.style.display = "block";
    body.style.left = x + "cqw";
    body.style.top = (skyH * (1 - yUp)) + "cqh";
    if (up) {
      var sun = mix([255, 224, 138], [247, 161, 90], Math.min(1, d * 2));
      set("--sun", rgb(sun));
      set("--sun-halo", rgb(sun, 0.25));
    }
    // Stars: a fixed scatter, fading in late in the evening.
    var starAlpha = Math.max(0, Math.min(1, (d - 0.6) / 0.4));
    if (starAlpha > 0) {
      var stars = document.getElementById("stars"), seed = 11;
      var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (var i = 0; i < 16; i++) {
        var s = document.createElement("div");
        s.className = "star";
        var size = 0.5 + rnd() * 0.6;
        s.style.width = size + "cqw";
        s.style.left = (rnd() * 100) + "cqw";
        s.style.top = (skyH * (1 - (0.3 + 0.7 * rnd()))) + "cqh";
        s.style.opacity = (starAlpha * (0.5 + 0.5 * rnd())).toFixed(2);
        stars.appendChild(s);
      }
    }
  }

  window.UshiLoading = {
    init: function (base) {
      var now = new Date();
      try { paintSky(now.getHours() + now.getMinutes() / 60); } catch (e) { console.warn(e); }
      cow = document.getElementById("cow");
      trail = document.getElementById("trail");
      pct = document.querySelector("#status .pct");
      var mine = storedCow();
      var img = new Image();
      if (mine) {
        img.onload = function () { show(img, mine.w || 1); };
        img.src = mine.src;
      } else {
        // First visit (or nothing stored): the painted calf.
        img.onload = function () {
          var painted;
          try { painted = paintCalf(img); } catch (e) { painted = { pic: img, w: 1 }; }
          show(painted.pic, painted.w * CALF_SCALE);
        };
        img.src = base + "/calf.png";
      }
      requestAnimationFrame(frame);
    },
    set: function (p) { if (p > target) target = p; },
    // For trying the screen at another hour.
    sky: function (hour) { paintSky(hour); },
    done: function () {
      finished = true; target = 1;
      var root = document.getElementById("loading");
      setTimeout(function () { cow.classList.add("home"); }, 500);
      setTimeout(function () { root.classList.add("done"); }, 900);
      setTimeout(function () { root.style.display = "none"; }, 1600);
    },
    fail: function (text) {
      var e = document.getElementById("loading-error");
      e.textContent = text;
      e.style.display = "block";
    },
  };
})();
