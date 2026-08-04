/* ============================================================
   SPLASH SCREEN — assets/js/splash.js
   1. Animación de semillas en canvas
   2. Redirige a index.html tras 3.2 s
   ============================================================ */

/* ── 1. ANIMACIÓN DE SEMILLAS ── */
(function () {
  const canvas = document.getElementById('seed-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, seeds = [];

  const COLORS = [
    'rgba(255,210,60,',
    'rgba(200,140,40,',
    'rgba(140,200,60,',
    'rgba(255,160,30,',
    'rgba(220,180,80,',
  ];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeSeed() {
    return {
      x:    rand(0, W),
      y:    rand(H * .3, H + 40),
      vx:   rand(-.35, .35),
      vy:  -rand(.25, .75),
      rot:  rand(0, Math.PI * 2),
      drot: rand(-.018, .018),
      op:   rand(.10, .28),
      size: rand(2.5, 6.5),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      type:  Math.random(),
      decay: rand(.0008, .0022),
    };
  }

  function initSeeds() {
    const n = Math.min(Math.floor((W * H) / 7000), 130);
    seeds = Array.from({ length: n }, makeSeed);
    seeds.forEach(s => { s.y = rand(0, H); });
  }

  function drawOval(s) {
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.globalAlpha = s.op;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.size * .55, s.size * 1.4, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-s.size*.2, -s.size*.4, 0, s.size*.3, s.size*.5, s.size * 1.5);
    g.addColorStop(0, s.color + '.95)'); g.addColorStop(1, s.color + '.25)');
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }

  function drawRound(s) {
    ctx.save();
    ctx.translate(s.x, s.y); ctx.globalAlpha = s.op;
    ctx.beginPath(); ctx.arc(0, 0, s.size * .7, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-s.size*.2, -s.size*.2, 0, 0, 0, s.size);
    g.addColorStop(0, s.color + '.90)'); g.addColorStop(1, s.color + '.15)');
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }

  function drawSpike(s) {
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.rot);
    ctx.globalAlpha = s.op * .85;
    ctx.strokeStyle = s.color + '.80)';
    ctx.lineWidth = s.size * .22; ctx.lineCap = 'round';
    const h = s.size * 2.8;
    ctx.beginPath(); ctx.moveTo(0, h*.5); ctx.lineTo(0, -h*.5); ctx.stroke();
    for (let i = -1; i <= 1; i += 2) {
      for (let j = 0; j < 2; j++) {
        const y = -h * (.05 + j * .22);
        ctx.beginPath(); ctx.moveTo(0, y);
        ctx.lineTo(i * s.size * .7, y - s.size * .55); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawSeed(s) {
    if      (s.type < .50) drawOval(s);
    else if (s.type < .80) drawRound(s);
    else                   drawSpike(s);
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (let i = seeds.length - 1; i >= 0; i--) {
      const s = seeds[i];
      s.x += s.vx; s.y += s.vy; s.rot += s.drot; s.op -= s.decay;
      if (s.y < -20 || s.op <= 0 || s.x < -20 || s.x > W + 20) {
        seeds[i] = makeSeed(); seeds[i].y = H + rand(0, 30);
      }
      drawSeed(s);
    }
    if (seeds.length < 130 && Math.random() < .04) {
      const s = makeSeed(); s.y = H + 10; seeds.push(s);
    }
    requestAnimationFrame(tick);
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  resize(); initSeeds(); tick();
  window.addEventListener('resize', () => { resize(); initSeeds(); });
})();


/* ── 2. OCULTAR SPLASH ── */
(function () {
  const DURACION_MS = 3200;

  window.addEventListener('load', function () {
    setTimeout(function () {
      const splash = document.querySelector('.logo-wrapper');
      if (splash) {
        splash.style.transition = 'opacity .6s ease';
        splash.style.opacity    = '0';
      }

      setTimeout(function () {
        // Si está en iframe, oculta el frame desde el padre
        if (window.parent !== window) {
          const frame = window.parent.document.getElementById('splash-frame');
          if (frame) {
            frame.style.transition = 'opacity .6s ease';
            frame.style.opacity    = '0';
            setTimeout(function () { frame.remove(); }, 650);
          }
        } else {
          window.location.href = 'index.html'; // splash.html solo sigue igual
        }
      }, 650);

    }, DURACION_MS);
  });
})();