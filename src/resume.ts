import './style.css';
import './resume.css';
import { revealEmails } from './email';

revealEmails();

document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
