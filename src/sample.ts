import type { DrillSource } from './format/types.js';

/** A small worked example: a third-shot drop and walk in. Used by the tests and the demo. */
export function sampleDrill(): DrillSource {
  return {
    format: 'drill-diagram',
    version: 1,
    title: 'Third-shot drop and walk in',
    caption:
      'D feeds from the kitchen line. A hits a curved drop into the opposing kitchen, then A and B walk up together to the transition zone and the kitchen line.',
    view: 'full',
    side: 'bottom',
    orient: 'portrait',
    items: [
      { type: 'zone', x: 3, y: 16.5, w: 6, h: 4, label: 'Target' },
      { type: 'cone', x: 2, y: 33 },
      { type: 'cone', x: 18, y: 33 },
      { type: 'player', x: 7, y: 40, label: 'A', team: 'orange' },
      { type: 'player', x: 15, y: 41, label: 'B', team: 'orange' },
      { type: 'player', x: 14, y: 14.5, label: 'D', team: 'blue' },
      { type: 'move', x1: 7, y1: 38.4, x2: 7, y2: 31 },
      { type: 'move', x1: 15, y1: 39.4, x2: 15, y2: 31 },
      { type: 'ball', n: 1, curve: false, bend: 1, x1: 13.4, y1: 15.9, x2: 7.6, y2: 38.4 },
      { type: 'ball', n: 2, curve: true, bend: -1, x1: 6.4, y1: 38.4, x2: 6, y2: 19 },
    ],
  };
}
