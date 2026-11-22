/**
 * The jobs film in Contact. Without reduced motion it loads as the section nears the screen,
 * plays while visible and pauses when scrolled away. Under reduced motion it never starts on its
 * own: the poster (the Star, "Available now") rests and the button plays it. The button always
 * works, so a looping film can be paused (WCAG 2.2.2).
 */
export function mountFilm(figure: HTMLElement) {
  const video = figure.querySelector<HTMLVideoElement>('video');
  const toggle = figure.querySelector<HTMLButtonElement>('.film-card__toggle');
  if (!video || !toggle) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  video.muted = true;
  let userPaused = reduced;
  let onScreen = false;

  const render = () => {
    const playing = !video.paused;
    toggle.textContent = playing ? 'Pause the film' : 'Play the film';
  };
  const play = () => {
    video.preload = 'auto';
    video.play().catch(() => {});
  };

  video.addEventListener('play', render);
  video.addEventListener('pause', render);
  toggle.addEventListener('click', () => {
    if (video.paused) {
      userPaused = false;
      play();
    } else {
      userPaused = true;
      video.pause();
    }
  });
  toggle.hidden = false;
  render();

  new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen && !userPaused) play();
      else if (!onScreen) video.pause();
    },
    { threshold: 0.35 },
  ).observe(video);
}
