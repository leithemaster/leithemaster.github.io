import './style.css';
import './resume.css';
import { revealEmails } from './email';

revealEmails();

/*
 * Two ways to print. "styled" keeps the tarot card (paper stock, gilt frame, corner stars);
 * "plain" is black on white for applicant tracking systems, and is also what Ctrl+P gives.
 * The choice is a data-print attribute on <html> that the print stylesheet reads.
 * ?print=styled or ?print=plain in the URL presets it (handy for saving a PDF).
 */
const root = document.documentElement;
const preset = new URLSearchParams(location.search).get('print');
if (preset === 'styled' || preset === 'plain') root.dataset.print = preset;

document.querySelectorAll<HTMLButtonElement>('button[data-print]').forEach((button) => {
  button.addEventListener('click', () => {
    root.dataset.print = button.dataset.print;
    window.print();
  });
});

// After the dialog closes, Ctrl+P goes back to the plain default.
window.addEventListener('afterprint', () => {
  if (!preset) delete root.dataset.print;
});
