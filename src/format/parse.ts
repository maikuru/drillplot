import { BOUNDS, FORMAT_NAME, FORMAT_VERSION, LEGACY_TEAMS, LIMITS, PLAYER_COLORS } from './limits.js';
import type {
  Ball,
  DrillSource,
  ErrorKey,
  Item,
  ParseError,
  ParseResult,
  PlayerColor,
} from './types.js';

const round2 = (v: number): number => Math.round(v * 100) / 100;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Length in code points, which is what JSON Schema's maxLength counts. */
const len = (s: string): number => [...s].length;

/**
 * Characters that cannot be written in XML 1.0 (so the exported SVG would not open), other
 * C0 controls and DEL, and unpaired surrogates. Titles and labels are one line: no control
 * character at all. The caption may hold tab, newline and carriage return.
 */
const BAD_ONE_LINE = /[\u0000-\u001F\u007F\uFFFE\uFFFF\uD800-\uDFFF]/u;
const BAD_MULTI_LINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF\uD800-\uDFFF]/u;

const MESSAGES: Record<ErrorKey, string> = {
  not_json: 'That is not valid JSON.',
  not_an_object: 'A drill diagram is a JSON object.',
  wrong_format: 'That does not look like a drill diagram.',
  unsupported_version: 'This diagram was made with a newer version of the format.',
  not_text: 'This value must be text.',
  title_too_long: `The title is longer than ${LIMITS.titleLength} characters.`,
  caption_too_long: `The caption is longer than ${LIMITS.captionLength} characters.`,
  label_too_long: 'A label is too long.',
  bad_character: 'Text may not contain control characters or broken Unicode (a caption may have line breaks and tabs).',
  bad_view: 'The view must be "full", "half" or "kitchen".',
  bad_side: 'The side must be "bottom" or "top".',
  bad_orient: 'The orientation must be "portrait" or "landscape".',
  items_not_array: 'The items must be a list.',
  too_many_items: `A diagram holds at most ${LIMITS.maxItems} items.`,
  item_not_object: 'Each item must be an object.',
  unknown_item_type: 'Unknown item type.',
  not_a_number: 'This value must be a finite number.',
  out_of_bounds: 'This position is outside the court and its margin.',
  bad_size: 'This size is out of range.',
  bad_angle: 'The angle must be from 0 up to (not including) 360 degrees.',
  bad_team: 'The player color must be "orange", "blue", "white" or "black".',
  bad_bend: 'The bend must be 1 or -1.',
  bad_shot_number: `A shot number must be a whole number from 1 to ${LIMITS.maxShot}.`,
  not_boolean: 'This value must be true or false.',
  no_svg_source: 'That SVG has no diagram source in it. Only SVGs made by drillplot can be reopened.',
  bad_svg_source: 'The source inside that SVG is damaged.',
  empty_input: 'Paste an SVG or JSON first.',
};

class Collector {
  errors: ParseError[] = [];
  add(key: ErrorKey, path: string): void {
    this.errors.push({ key, path, message: MESSAGES[key] });
  }
}

type Range = readonly [number, number];
const X: Range = [BOUNDS.xMin, BOUNDS.xMax];
const Y: Range = [BOUNDS.yMin, BOUNDS.yMax];

function num(c: Collector, v: unknown, path: string, range?: Range, rangeKey: ErrorKey = 'out_of_bounds'): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    c.add('not_a_number', path);
    return undefined;
  }
  if (range && (v < range[0] || v > range[1])) {
    c.add(rangeKey, path);
    return undefined;
  }
  return round2(v);
}

function text(c: Collector, v: unknown, path: string, max: number, tooLong: ErrorKey, multiLine = false): string {
  if (v === undefined) return '';
  if (typeof v !== 'string') {
    c.add('not_text', path);
    return '';
  }
  if (len(v) > max) {
    c.add(tooLong, path);
    return '';
  }
  if ((multiLine ? BAD_MULTI_LINE : BAD_ONE_LINE).test(v)) {
    c.add('bad_character', path);
    return '';
  }
  return v;
}

function team(c: Collector, v: unknown, path: string): PlayerColor {
  if (v === undefined) return 'orange';
  if (typeof v === 'string') {
    if ((PLAYER_COLORS as readonly string[]).includes(v)) return v as PlayerColor;
    const legacy = Object.hasOwn(LEGACY_TEAMS, v) ? LEGACY_TEAMS[v] : undefined;
    if (legacy) return legacy;
  }
  c.add('bad_team', path);
  return 'orange';
}

function item(c: Collector, raw: unknown, path: string): Item | undefined {
  if (!isObj(raw)) {
    c.add('item_not_object', path);
    return undefined;
  }
  const before = c.errors.length;
  let out: Item | undefined;
  switch (raw['type']) {
    case 'player': {
      const x = num(c, raw['x'], `${path}/x`, X);
      const y = num(c, raw['y'], `${path}/y`, Y);
      const label = text(c, raw['label'], `${path}/label`, LIMITS.playerLabelLength, 'label_too_long');
      const t = team(c, raw['team'], `${path}/team`);
      out = { type: 'player', x: x ?? 0, y: y ?? 0, label, team: t };
      break;
    }
    case 'machine': {
      const x = num(c, raw['x'], `${path}/x`, X);
      const y = num(c, raw['y'], `${path}/y`, Y);
      // check the range on the value as given, then round: 359.996 is valid and rounds to 360, which is 0
      let a = 0;
      const rawAngle = raw['angle'];
      if (rawAngle !== undefined) {
        if (typeof rawAngle !== 'number' || !Number.isFinite(rawAngle)) c.add('not_a_number', `${path}/angle`);
        else if (rawAngle < 0 || rawAngle >= 360) c.add('bad_angle', `${path}/angle`);
        else a = round2(rawAngle) % 360;
      }
      out = { type: 'machine', x: x ?? 0, y: y ?? 0, angle: a };
      break;
    }
    case 'cone': {
      const x = num(c, raw['x'], `${path}/x`, X);
      const y = num(c, raw['y'], `${path}/y`, Y);
      out = { type: 'cone', x: x ?? 0, y: y ?? 0 };
      break;
    }
    case 'zone': {
      const x = num(c, raw['x'], `${path}/x`, X);
      const y = num(c, raw['y'], `${path}/y`, Y);
      const w = num(c, raw['w'], `${path}/w`, [LIMITS.zoneWidth.min, LIMITS.zoneWidth.max], 'bad_size');
      const h = num(c, raw['h'], `${path}/h`, [LIMITS.zoneHeight.min, LIMITS.zoneHeight.max], 'bad_size');
      const label = text(c, raw['label'], `${path}/label`, LIMITS.zoneLabelLength, 'label_too_long');
      out = { type: 'zone', x: x ?? 0, y: y ?? 0, w: w ?? 1, h: h ?? 1, label };
      break;
    }
    case 'move':
    case 'ball': {
      const x1 = num(c, raw['x1'], `${path}/x1`, X);
      const y1 = num(c, raw['y1'], `${path}/y1`, Y);
      const x2 = num(c, raw['x2'], `${path}/x2`, X);
      const y2 = num(c, raw['y2'], `${path}/y2`, Y);
      const pts = { x1: x1 ?? 0, y1: y1 ?? 0, x2: x2 ?? 0, y2: y2 ?? 0 };
      if (raw['type'] === 'move') {
        out = { type: 'move', ...pts };
        break;
      }
      let curve = false;
      if (raw['curve'] !== undefined) {
        if (typeof raw['curve'] === 'boolean') curve = raw['curve'];
        else c.add('not_boolean', `${path}/curve`);
      }
      let bend: 1 | -1 = 1;
      if (raw['bend'] !== undefined) {
        if (raw['bend'] === 1 || raw['bend'] === -1) bend = raw['bend'];
        else c.add('bad_bend', `${path}/bend`);
      }
      let n = 1;
      if (typeof raw['n'] === 'number' && Number.isInteger(raw['n']) && raw['n'] >= 1 && raw['n'] <= LIMITS.maxShot) n = raw['n'];
      else c.add('bad_shot_number', `${path}/n`);
      const ball: Ball = { type: 'ball', ...pts, curve, bend, n };
      out = ball;
      break;
    }
    default:
      c.add('unknown_item_type', `${path}/type`);
      return undefined;
  }
  return c.errors.length > before ? undefined : out;
}

/**
 * Validates and normalizes a drill diagram. Accepts an already parsed value or a JSON string.
 * Markup in labels is just text: the renderer escapes it. Unknown properties are dropped (this
 * is how the editor's internal ids from older exports disappear). Older team keys t1, t2 and
 * coach become orange, blue and black.
 */
export function parseSource(input: unknown): ParseResult {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      return fail('not_json', '');
    }
  }
  if (!isObj(value)) return fail('not_an_object', '');
  const c = new Collector();
  if (value['format'] !== FORMAT_NAME) c.add('wrong_format', '/format');
  if (value['format'] === FORMAT_NAME && value['version'] !== FORMAT_VERSION) c.add('unsupported_version', '/version');
  const title = text(c, value['title'], '/title', LIMITS.titleLength, 'title_too_long');
  const caption = text(c, value['caption'], '/caption', LIMITS.captionLength, 'caption_too_long', true);
  let view: DrillSource['view'] = 'full';
  if (value['view'] !== undefined) {
    if (value['view'] === 'full' || value['view'] === 'half' || value['view'] === 'kitchen') view = value['view'];
    else c.add('bad_view', '/view');
  }
  let side: DrillSource['side'] = 'bottom';
  if (value['side'] !== undefined) {
    if (value['side'] === 'bottom' || value['side'] === 'top') side = value['side'];
    else c.add('bad_side', '/side');
  }
  let orient: DrillSource['orient'] = 'portrait';
  if (value['orient'] !== undefined) {
    if (value['orient'] === 'portrait' || value['orient'] === 'landscape') orient = value['orient'];
    else c.add('bad_orient', '/orient');
  }
  const items: Item[] = [];
  const raw = value['items'];
  if (!Array.isArray(raw)) c.add('items_not_array', '/items');
  else if (raw.length > LIMITS.maxItems) c.add('too_many_items', '/items');
  else
    raw.forEach((r, i) => {
      const it = item(c, r, `/items/${i}`);
      if (it) items.push(it);
    });
  if (c.errors.length) return { ok: false, errors: c.errors };
  return { ok: true, source: { format: FORMAT_NAME, version: FORMAT_VERSION, title, caption, view, side, orient, items } };
}

function fail(key: ErrorKey, path: string): ParseResult {
  return { ok: false, errors: [{ key, path, message: MESSAGES[key] }] };
}

/** Result of a validity check only. */
export function validateSource(input: unknown): ParseError[] {
  const r = parseSource(input);
  return r.ok ? [] : r.errors;
}

export function errorMessage(key: ErrorKey): string {
  return MESSAGES[key];
}

/** A source with nothing on the court. */
export function emptySource(): DrillSource {
  return { format: FORMAT_NAME, version: FORMAT_VERSION, title: '', caption: '', view: 'full', side: 'bottom', orient: 'portrait', items: [] };
}
