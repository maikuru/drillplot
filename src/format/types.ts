/** Player colors: the Okabe-Ito set, chosen to differ in lightness as well as hue. */
export type PlayerColor = 'orange' | 'blue' | 'white' | 'black';
export type CourtView = 'full' | 'half' | 'kitchen';
export type HalfSide = 'bottom' | 'top';
export type Orientation = 'portrait' | 'landscape';
/** Colors a ball path, movement arrow or line may take instead of its default. */
export type PathColor = 'yellow' | 'white' | 'orange' | 'red' | 'pink' | 'green' | 'black';
/** Since 0.3. A player's dominant hand. */
export type Hand = 'right' | 'left';
/** Since 0.3. Where a region's label sits, as the region is drawn on the page. */
export type LabelPosition = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/*
 * Fields marked "Since 0.2" are optional and absent from a source that does not use them: the
 * reader does not fill them in, so a document written for 0.1 normalizes, saves and draws
 * exactly as it did.
 *
 * Fields and items marked "Since 0.3" follow the same rule, so a document written for 0.2 also
 * normalizes and draws exactly as it did. Every item may also carry `moment`.
 */

/** Since 0.3. Fields every item may carry. */
interface Common {
  /** Which court, 1 or more, when the diagram has `courts`. */
  court?: number;
  /**
   * Since 0.3. The moment the item belongs to, 1 to 9. On each court, items of an earlier moment
   * than the latest one there are drawn faded, and players of an earlier moment as rings in their
   * team color. Items with no moment are drawn as usual.
   */
  moment?: number;
}

export interface Player extends Common {
  type: 'player';
  x: number;
  y: number;
  label: string;
  team: PlayerColor;
  /** Since 0.2. A role or name written under the disc, up to 16 characters. */
  note?: string;
  /** Since 0.2. Drawn as a dashed ring: where the player starts or was. */
  ghost?: boolean;
  /** Since 0.2. A legend badge (see `legend`). */
  key?: string;
  /** Since 0.3. The dominant hand: a small paddle is drawn on the forehand side, facing the net. */
  hand?: Hand;
  /**
   * Since 0.3. A name for a pair, up to 8 characters. Two players on the same court, in the same
   * moment, with the same tether are joined by a tether drawn between them.
   */
  tether?: string;
}
export interface Machine extends Common {
  type: 'machine';
  x: number;
  y: number;
  /** Degrees clockwise from "up the page", 0 to under 360. */
  angle: number;
  key?: string;
}
export interface Cone extends Common {
  type: 'cone';
  x: number;
  y: number;
  /** Since 0.2. A short name beside the cone, up to 6 characters, such as T1. */
  label?: string;
  key?: string;
}
export interface Zone extends Common {
  type: 'zone';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** Since 0.2. Drawn as a dashed outline only: space left open. */
  ghost?: boolean;
  key?: string;
}
export interface Move extends Common {
  type: 'move';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Since 0.2. Default white. */
  color?: PathColor;
  key?: string;
}
export interface Ball extends Common {
  type: 'ball';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  curve: boolean;
  /** Which side a curved path bows toward. */
  bend: 1 | -1;
  /** Shot number, 1 or more. */
  n: number;
  /** Since 0.2. Default yellow. */
  color?: PathColor;
  /** Since 0.2. A dashed path: a cooperative or optional shot. */
  dash?: boolean;
  /** Since 0.2. One letter, a to z: paths with the same `n` and an `alt` are either-or choices for that shot. */
  alt?: string;
}

/** Since 0.2. A plain line with no arrowhead, such as a line across the court to split-step on. */
export interface Line extends Common {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Default white. */
  color?: PathColor;
  dash?: boolean;
  /** Up to 24 characters, written beside the line's end. */
  label?: string;
  key?: string;
}

/**
 * Since 0.3. A named region of the court: a neutral shaded box with a label placed where you
 * choose, distinct from the orange target `zone`. With `mirror`, one item is a band on both halves.
 */
export interface Region extends Common {
  type: 'region';
  x: number;
  y: number;
  w: number;
  h: number;
  /** Up to 24 characters. */
  label: string;
  /** Default center. */
  labelAt?: LabelPosition;
  /** Also drawn reflected across the net. */
  mirror?: boolean;
  key?: string;
}

/** Since 0.2. A legend badge at a point on the court. */
export interface Mark extends Common {
  type: 'mark';
  x: number;
  y: number;
  key: string;
}

/** Since 0.2. A note drawn under the court: for the badge with the same key, or after a color swatch. */
export interface LegendEntry {
  key?: string;
  /** A swatch of a path color, for a note with no key. */
  color?: PathColor;
  /** Since 0.3. A swatch of a tether in a player color, for a note with no key or color. */
  tether?: PlayerColor;
  text: string;
}

/** Since 0.2. One of several courts drawn side by side. */
export interface Court {
  /** Written above the court, up to 24 characters. */
  label?: string;
  /** Written in the gap after this court, with an arrow to the next one, up to 40 characters. */
  link?: string;
}

export type Item = Player | Machine | Cone | Zone | Move | Ball | Line | Mark | Region;
export type ItemType = Item['type'];

/**
 * The editable source of a drill diagram. All positions are court feet:
 * x runs 0..20 across the court, y runs 0..44 end line to end line, the net is at y = 22.
 */
export interface DrillSource {
  format: 'drill-diagram';
  version: 1;
  title: string;
  caption: string;
  view: CourtView;
  side: HalfSide;
  orient: Orientation;
  /** Since 0.2. Also draw the caption as text under the court. */
  showCaption?: boolean;
  /** Since 0.2. One to four courts, side by side; items say which with `court`. */
  courts?: Court[];
  /** Since 0.2. Notes drawn under the court, matched to badges by key. */
  legend?: LegendEntry[];
  items: Item[];
}

/** Stable, machine-readable error keys. Messages are for people and may change; keys will not. */
export type ErrorKey =
  | 'not_json'
  | 'not_an_object'
  | 'wrong_format'
  | 'unsupported_version'
  | 'not_text'
  | 'title_too_long'
  | 'caption_too_long'
  | 'label_too_long'
  | 'bad_character'
  | 'bad_view'
  | 'bad_side'
  | 'bad_orient'
  | 'items_not_array'
  | 'too_many_items'
  | 'item_not_object'
  | 'unknown_item_type'
  | 'not_a_number'
  | 'out_of_bounds'
  | 'bad_size'
  | 'bad_angle'
  | 'bad_team'
  | 'bad_bend'
  | 'bad_shot_number'
  | 'not_boolean'
  | 'bad_color'
  | 'bad_key'
  | 'bad_alt'
  | 'bad_court'
  | 'bad_courts'
  | 'bad_legend'
  | 'bad_moment'
  | 'bad_hand'
  | 'bad_tether'
  | 'bad_label_position'
  | 'no_svg_source'
  | 'bad_svg_source'
  | 'empty_input';

export interface ParseError {
  key: ErrorKey;
  /** JSON-pointer-like location, e.g. "/items/3/x". Empty string for the document. */
  path: string;
  message: string;
}

export type ParseResult = { ok: true; source: DrillSource } | { ok: false; errors: ParseError[] };
