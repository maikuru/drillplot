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
  /** Since 0.2. */
  noteLength: 16,
  coneLabelLength: 6,
  lineLabelLength: 24,
  keyLength: 3,
  legendEntries: 20,
  legendTextLength: 100,
  courts: { min: 1, max: 4 },
  courtLabelLength: 24,
  courtLinkLength: 40,
  /** Unreleased. */
  moments: { min: 1, max: 9 },
  tetherLength: 8,
  regionLabelLength: 24,
  regionWidth: { min: 0.5, max: COURT.width + 2 * MARGIN },
  regionHeight: { min: 0.5, max: COURT.length + 2 * MARGIN },
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

/** Since 0.2. Path colors and what they draw as. */
export const PATH_COLORS = ['yellow', 'white', 'orange', 'red', 'pink', 'green', 'black'] as const;

/** Unreleased. Where a region's label may sit. */
export const LABEL_POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
