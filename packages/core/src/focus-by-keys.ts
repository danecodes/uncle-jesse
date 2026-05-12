import type { TVDevice } from './tv-device.js';
import type { RemoteKey } from './types.js';
import type { UIElement } from './ui-element.js';

export interface FocusByKeysOptions {
  /** Sequence of keys to press, in order. The last key drives toward `targetId`. */
  keys: RemoteKey[];
  /** Max presses per key before moving on. Default: 6. */
  maxPressesPerKey?: number;
  /**
   * Optional waypoints. When provided, every non-final key drives until the
   * focused id matches one of these (or its budget is exhausted, in which
   * case the helper moves on to the next key). The final key always drives
   * toward `targetId`.
   */
  intermediateIds?: string[];
}

interface PressRecord {
  key: RemoteKey;
  landedId: string | null;
}

/**
 * Drive D-pad keys until the focused element's id matches `targetId`.
 *
 * Bypasses the geometric walker used by `LiveElement.focus()`. Useful when
 * the caller knows the navigation route (e.g. "Up to exit the row, then
 * Right along the action bar") and bounds-based pathing can't help — for
 * example escaping a horizontal `FocusLayoutGroup` into a sibling vertical
 * group, or when two candidate directions oscillate.
 */
export async function focusByKeys(
  device: TVDevice,
  targetId: string | string[],
  options: FocusByKeysOptions,
): Promise<void> {
  const targets = new Set(Array.isArray(targetId) ? targetId : [targetId]);
  const intermediates = options.intermediateIds && options.intermediateIds.length > 0
    ? new Set(options.intermediateIds)
    : null;
  const maxPresses = options.maxPressesPerKey ?? 6;
  const { keys } = options;

  if (keys.length === 0) {
    throw new Error('focusByKeys: options.keys must contain at least one key');
  }

  let currentId = await readFocusedId(device);
  if (currentId !== null && targets.has(currentId)) return;

  const trail: PressRecord[] = [];
  const budgetsExhausted: RemoteKey[] = [];

  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const key = keys[keyIdx];
    const isLast = keyIdx === keys.length - 1;
    const stopOnIntermediate = !isLast && intermediates !== null;

    let reachedStop = false;
    for (let press = 0; press < maxPresses; press++) {
      const prevFp = await readFocusedFingerprint(device);
      await device.press(key);
      currentId = await pollForFocusChange(device, prevFp);
      trail.push({ key, landedId: currentId });

      if (currentId !== null && targets.has(currentId)) {
        reachedStop = true;
        break;
      }
      if (stopOnIntermediate && currentId !== null && intermediates!.has(currentId)) {
        reachedStop = true;
        break;
      }
    }

    if (!reachedStop) budgetsExhausted.push(key);

    if (currentId !== null && targets.has(currentId)) return;
  }

  const targetStr = Array.isArray(targetId) ? `[${targetId.join(', ')}]` : `'${targetId}'`;
  const pathStr = trail.map((t) => `${t.key}→${t.landedId ?? '?'}`).join(', ') || '<no presses>';
  const exhaustedStr = budgetsExhausted.length > 0
    ? ` Budgets exhausted on: ${budgetsExhausted.join(', ')}.`
    : '';
  throw new Error(
    `focusByKeys: never reached ${targetStr}. Ended on '${currentId ?? '<no focus>'}' ` +
    `after ${trail.length} press${trail.length === 1 ? '' : 'es'}.${exhaustedStr} Path: ${pathStr}`,
  );
}

async function readFocusedId(device: TVDevice): Promise<string | null> {
  const el = await device.getFocusedElement();
  return el?.id ?? null;
}

async function readFocusedFingerprint(device: TVDevice): Promise<string | null> {
  const el = await device.getFocusedElement();
  return fingerprint(el);
}

function fingerprint(el: UIElement | null): string | null {
  if (!el) return null;
  return `${el.tag}#${el.id ?? '?'}@${el.getAttribute('bounds') ?? '?'}`;
}

async function pollForFocusChange(
  device: TVDevice,
  prevFp: string | null,
  timeoutMs = 2000,
): Promise<string | null> {
  const start = Date.now();
  let delay = 150;
  while (Date.now() - start < timeoutMs) {
    await sleep(delay);
    delay = Math.min(delay * 2, 400);
    const el = await device.getFocusedElement();
    const fp = fingerprint(el);
    if (fp !== prevFp) return el?.id ?? null;
  }
  const el = await device.getFocusedElement();
  return el?.id ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
