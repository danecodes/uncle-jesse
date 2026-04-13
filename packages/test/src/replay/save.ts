import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { ReplayTimeline } from './types.js';
import { generateReplayHtml } from './viewer.js';

export async function saveReplay(
  timeline: ReplayTimeline,
  outputDir = './test-results',
): Promise<{ htmlPath: string; jsonPath: string }> {
  await mkdir(outputDir, { recursive: true });

  const slug = timeline.testName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const htmlPath = join(outputDir, `${slug}-replay.html`);
  const jsonPath = join(outputDir, `${slug}-replay.json`);

  const html = generateReplayHtml(timeline);
  const json = JSON.stringify(timeline, null, 2);

  await writeFile(htmlPath, html, 'utf-8');
  await writeFile(jsonPath, json, 'utf-8');

  return { htmlPath, jsonPath };
}
