const navToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('is-open');
  });
}

const canvas = document.getElementById('matrix-canvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (canvas && !reducedMotion.matches) {
  const context = canvas.getContext('2d');
  const glyphs = '0123456789ABCDEF'.split('');
  const densityStep = 100;
  const speed = 400;
  const columns = [];
  let width = 0;
  let height = 0;
  let lastFrame = 0;

  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    width = Math.floor(window.innerWidth);
    height = Math.floor(window.innerHeight);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const count = Math.max(1, Math.ceil(width / densityStep));
    columns.length = count;
    for (let i = 0; i < count; i += 1) {
      columns[i] = columns[i] ?? Math.random() * height;
    }
  };

  const draw = (timestamp) => {
    const delta = Math.min(32, timestamp - lastFrame || 16);
    lastFrame = timestamp;

    context.fillStyle = 'rgba(2, 6, 3, 0.12)';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#57ff75';
    context.font = '18px monospace';

    columns.forEach((y, index) => {
      const char = glyphs[(Math.random() * glyphs.length) | 0];
      const x = index * densityStep + 24;
      const nextY = (y + (speed * delta) / 1000) % (height + 32);
      context.fillText(char, x, nextY);
      columns[index] = nextY > height ? 0 : nextY;
    });

    requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  requestAnimationFrame(draw);
}
