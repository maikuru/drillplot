/** Player colors: the Okabe-Ito set, chosen to differ in lightness as well as hue. */
export type PlayerColor = 'orange' | 'blue' | 'white' | 'black';
export type CourtView = 'full' | 'half' | 'kitchen';
export type HalfSide = 'bottom' | 'top';
export type Orientation = 'portrait' | 'landscape';

export interface Player {
  type: 'player';
  x: number;
  y: number;
  label: string;
  team: PlayerColor;
}
export interface Machine {
  type: 'machine';
  x: number;
  y: number;
  /** Degrees clockwise from "up the page", 0 to under 360. */
  angle: number;
}
export interface Cone {
  type: 'cone';
  x: number;
  y: number;
}
export interface Zone {
  type: 'zone';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}
export interface Move {
  type: 'move';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface Ball {
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
}

export type Item = Player | Machine | Cone | Zone | Move | Ball;
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
