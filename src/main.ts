import './style.css';
import { SPREAD } from './cards';
import { revealEmails } from './email';
import { mountInk, trackFigure } from './ink';
import { mountTarot } from './tarot';

revealEmails();
mountTarot(document, SPREAD);

const hero = document.querySelector<HTMLElement>('.hero');
const canvas = document.querySelector<HTMLCanvasElement>('.hero__ink');
const photo = document.querySelector<HTMLImageElement>('.hero__photo');

if (hero && canvas && photo) {
  trackFigure(hero, photo);
  mountInk(canvas, hero);
}
