import { BOUNDS, FORMAT_NAME, FORMAT_VERSION, LEGACY_TEAMS, LIMITS, PATH_COLORS, PLAYER_COLORS } from './limits.js';
import type {
  Ball,
  DrillSource,
  ErrorKey,
  Item,
  ParseError,
  ParseResult,
  PathColor,
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
  bad_color: `The color must be one of ${PATH_COLORS.map((c) => `"${c}"`).join(', ')}.`,
  bad_key: `A legend key must be 1 to ${LIMITS.keyLength} characters of text on one line.`,
  bad_alt: 'An alternative must be one lower-case letter, a to z.',
  bad_court: 'The court must be a whole number from 1 to the number of courts.',
  bad_courts: `The courts must be a list of ${LIMITS.courts.min} to ${LIMITS.courts.max} objects.`,
  bad_legend: `The legend must be a list of at most ${LIMITS.legendEntries} notes, each an object with text.`,
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

/* Optional fields, since 0.2. Each is left out of the result when absent, so a 0.1 document normalizes as before. */

function optText(c: Collector, raw: Record<string, unknown>, k: string, path: string, max: number): string | undefined {
  if (raw[k] === undefined) return undefined;
  const t = text(c, raw[k], `${path}/${k}`, max, 'label_too_long');
  return t === '' ? undefined : t;
}

function optFlag(c: Collector, raw: Record<string, unknown>, k: string, path: string): true | undefined {
  const v = raw[k];
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') c.add('not_boolean', `${path}/${k}`);
  return v === true ? true : undefined;
}

function optColor(c: Collector, raw: Record<string, unknown>, path: string): PathColor | undefined {
  const v = raw['color'];
  if (v === undefined) return undefined;
  if (typeof v === 'string' && (PATH_COLORS as readonly string[]).includes(v)) return v as PathColor;
  c.add('bad_color', `${path}/color`);
  return undefined;
}

/** A legend key: 1 to 3 characters, one line. */
function key(c: Collector, v: unknown, path: string): string | undefined {
  if (typeof v === 'string' && v.trim() !== '' && len(v) <= LIMITS.keyLength && !BAD_ONE_LINE.test(v)) return v;
  c.add('bad_key', path);
  return undefined;
}

function optKey(c: Collector, raw: Record<string, unknown>, path: string): string | undefined {
  return raw['key'] === undefined ? undefined : key(c, raw['key'], `${path}/key`);
}

function optCourt(c: Collector, raw: Record<string, unknown>, path: string, courts: number): number | undefined {
  const v = raw['court'];
  if (v === undefined) return undefined;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= courts) return v;
  c.add('bad_court', `${path}/court`);
  return undefined;
}

/** Copies the optional fields that are set onto an item, in the order given. */
function withExtras<T extends Item>(it: T, extras: Record<string, unknown>): T {
  for (const [k, v] of Object.entries(extras)) if (v !== undefined) (it as unknown as Record<string, unknown>)[k] = v;
  return it;
}

function item(c: Collector, raw: unknown, path: string, courts = 1): Item | undefined {
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
      out = withExtras(
        { type: 'player', x: x ?? 0, y: y ?? 0, label, team: t },
        { note: optText(c, raw, 'note', path, LIMITS.noteLength), ghost: optFlag(c, raw, 'ghost', path), key: optKey(c, raw, path) },
      );
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
      out = withExtras({ type: 'machine', x: x ?? 0, y: y ?? 0, angle: a }, { key: optKey(c, raw, path) });
      break;
    }
    case 'cone': {
      const x = num(c, raw['x'], `${path}/x`, X);
      const y = num(c, raw['y'], `${path}/y`, Y);
      out = withExtras({ type: 'cone', x: x ?? 0, y: y ?? 0 }, { label: optText(c, raw, 'label', path, LIMITS.coneLabelLength), key: optKey(c, raw, path) });
      break;
    }
    case 'zone': {
      const x = num(c, raw['x'], `${path}/x`, X);
      const y = num(c, raw['y'], `${path}/y`, Y);
      const w = num(c, raw['w'], `${path}/w`, [LIMITS.zoneWidth.min, LIMITS.zoneWidth.max], 'bad_size');
      const h = num(c, raw['h'], `${path}/h`, [LIMITS.zoneHeight.min, LIMITS.zoneHeight.max], 'bad_size');
      const label = text(c, raw['label'], `${path}/label`, LIMITS.zoneLabelLength, 'label_too_long');
      out = withExtras({ type: 'zone', x: x ?? 0, y: y ?? 0, w: w ?? 1, h: h ?? 1, label }, { ghost: optFlag(c, raw, 'ghost', path), key: optKey(c, raw, path) });
      break;
    }
    case 'mark': {
      const x = num(c, raw['x'], `${path}/x`, X);
      const y = num(c, raw['y'], `${path}/y`, Y);
      const k = key(c, raw['key'], `${path}/key`);
      out = { type: 'mark', x: x ?? 0, y: y ?? 0, key: k ?? '' };
      break;
    }
    case 'move':
    case 'ball':
    case 'line': {
      const x1 = num(c, raw['x1'], `${path}/x1`, X);
      const y1 = num(c, raw['y1'], `${path}/y1`, Y);
      const x2 = num(c, raw['x2'], `${path}/x2`, X);
      const y2 = num(c, raw['y2'], `${path}/y2`, Y);
      const pts = { x1: x1 ?? 0, y1: y1 ?? 0, x2: x2 ?? 0, y2: y2 ?? 0 };
      if (raw['type'] === 'move') {
        out = withExtras({ type: 'move', ...pts }, { color: optColor(c, raw, path), key: optKey(c, raw, path) });
        break;
      }
      if (raw['type'] === 'line') {
        out = withExtras(
          { type: 'line', ...pts },
          { color: optColor(c, raw, path), dash: optFlag(c, raw, 'dash', path), label: optText(c, raw, 'label', path, LIMITS.lineLabelLength), key: optKey(c, raw, path) },
        );
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
      let alt: string | undefined;
      if (raw['alt'] !== undefined) {
        if (typeof raw['alt'] === 'string' && /^[a-z]$/.test(raw['alt'])) alt = raw['alt'];
        else c.add('bad_alt', `${path}/alt`);
      }
      const ball: Ball = { type: 'ball', ...pts, curve, bend, n };
      out = withExtras(ball, { color: optColor(c, raw, path), dash: optFlag(c, raw, 'dash', path), alt });
      break;
    }
    default:
      c.add('unknown_item_type', `${path}/type`);
      return undefined;
  }
  const court = optCourt(c, raw, path, courts);
  if (out && court !== undefined) out.court = court;
  return c.errors.length > before ? undefined : out;
}

function courtList(c: Collector, v: unknown): DrillSource['courts'] {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length < LIMITS.courts.min || v.length > LIMITS.courts.max || !v.every(isObj)) {
    c.add('bad_courts', '/courts');
    return undefined;
  }
  return v.map((r, i) => {
    const label = text(c, r['label'], `/courts/${i}/label`, LIMITS.courtLabelLength, 'label_too_long');
    const link = text(c, r['link'], `/courts/${i}/link`, LIMITS.courtLinkLength, 'label_too_long');
    return { ...(label ? { label } : {}), ...(link ? { link } : {}) };
  });
}

function legendList(c: Collector, v: unknown): DrillSource['legend'] {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > LIMITS.legendEntries || !v.every(isObj)) {
    c.add('bad_legend', '/legend');
    return undefined;
  }
  return v.map((r, i) => {
    const k = optKey(c, r, `/legend/${i}`);
    const color = optColor(c, r, `/legend/${i}`);
    // text is required: an absent one is not text
    const t = text(c, r['text'] ?? null, `/legend/${i}/text`, LIMITS.legendTextLength, 'label_too_long');
    return { ...(k !== undefined ? { key: k } : {}), ...(color ? { color } : {}), text: t };
  });
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
  const showCaption = optFlag(c, value, 'showCaption', '');
  const courts = courtList(c, value['courts']);
  const legend = legendList(c, value['legend']);
  const items: Item[] = [];
  const raw = value['items'];
  if (!Array.isArray(raw)) c.add('items_not_array', '/items');
  else if (raw.length > LIMITS.maxItems) c.add('too_many_items', '/items');
  else
    raw.forEach((r, i) => {
      const it = item(c, r, `/items/${i}`, courts?.length ?? 1);
      if (it) items.push(it);
    });
  if (c.errors.length) return { ok: false, errors: c.errors };
  const source: DrillSource = { format: FORMAT_NAME, version: FORMAT_VERSION, title, caption, view, side, orient, items };
  if (showCaption) source.showCaption = true;
  if (courts) source.courts = courts;
  if (legend) source.legend = legend;
  return { ok: true, source };
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
