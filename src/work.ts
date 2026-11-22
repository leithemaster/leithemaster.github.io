import './style.css';
import './work.css';

/*
 * Case study sheets: read a drawing one stage at a time. Each button sets data-stage on its
 * figure, and the CSS fades every part of the drawing that belongs to another stage.
 * Without this script the buttons stay hidden and the drawing shows whole.
 */
document.querySelectorAll<HTMLElement>('[data-stages]').forEach((group) => {
  const sheet = document.getElementById(group.dataset.stages!);
  if (!sheet) return;
  const note = sheet.querySelector('.sheet__note');
  const buttons = [...group.querySelectorAll<HTMLButtonElement>('button[data-stage]')];
  group.classList.add('is-live');

  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      const stage = button.dataset.stage!;
      if (stage === 'all') delete sheet.dataset.stage;
      else sheet.dataset.stage = stage;
      if (note) note.textContent = button.dataset.note ?? '';
    }),
  );
});
