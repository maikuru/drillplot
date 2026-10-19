/** Court geometry and input caps, in feet and characters. */
export const COURT = { width: 20, length: 44, netY: 22, kitchen: 7 } as const;

/** Court plus a margin: items may sit this far outside the court lines. */
export const MARGIN = 2;
export const BOUNDS = {
  xMin: -MARGIN,
  xMax: COURT.width + MARGIN,
  yMin: -MARGIN,
  yMax: COURT.length + MARGIN,
} as const;

export const LIMITS = {
  maxItems: 200,
  /** Highest shot number. */
  maxShot: 200,
  titleLength: 120,
  captionLength: 300,
  playerLabelLength: 8,
  zoneLabelLength: 24,
  zoneWidth: { min: 1, max: COURT.width },
  zoneHeight: { min: 1, max: COURT.length },
} as const;

export const FORMAT_NAME = 'drill-diagram' as const;
export const FORMAT_VERSION = 1 as const;

export const PLAYER_COLORS = ['orange', 'blue', 'white', 'black'] as const;
/** Older team keys still open. */
export const LEGACY_TEAMS: Readonly<Record<string, (typeof PLAYER_COLORS)[number]>> = {
  t1: 'orange',
  t2: 'blue',
  coach: 'black',
};
