import './style.css';
import './design.css';
import { SPREAD } from './cards';
import { mountInk } from './ink';
import { mountTarot } from './tarot';

mountTarot(document, SPREAD);

// The live ink specimen: the same engine as the hero, on its own panel.
const panel = document.querySelector<HTMLElement>('[data-ink-specimen]');
const canvas = panel?.querySelector('canvas');
if (panel && canvas) mountInk(canvas, panel);
