import type { CardFace } from './tarot';

/** The spread, shared by the reading and the design document. */
export const SPREAD: Record<string, CardFace> = {
  past: { numeral: 'I', name: 'The Magician', position: 'The past', emblem: 'magician' },
  present: { numeral: '0', name: 'The Fool', position: 'The present', emblem: 'fool' },
  future: { numeral: 'XVII', name: 'The Star', position: 'The future', emblem: 'star' },
};
