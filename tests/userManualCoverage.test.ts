import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { PROJECT_NAVIGATION } from '../features/projects/model/projectNavigation';
import { SIDEBAR_NAVIGATION } from '../config/navigation';
import coverage from '../docs/user-manual/coverage.json';
import catalog from '../docs/user-manual/catalog-screenshots.json';

describe('obrazové pokrytí běžných funkcí příručky', () => {
  it('má obrazovou kapitolu pro každou položku projektové a hlavní uživatelské navigace', () => {
    const markdown = readFileSync('public/user-manual/index.md', 'utf8');
    const projectCoverage: Record<string, string> = coverage.projectNavigation;
    const sidebarCoverage: Record<string, string> = coverage.sidebarNavigation;
    const navigation = SIDEBAR_NAVIGATION.flatMap(item => item.children || [item]);
    for (const item of PROJECT_NAVIGATION) expect(projectCoverage[item.id], item.label).toBeTruthy();
    for (const item of navigation) expect(sidebarCoverage[item.id], item.label).toBeTruthy();
    for (const name of [...Object.values(projectCoverage), ...Object.values(sidebarCoverage), ...coverage.personalSettings, ...catalog]) {
      expect(markdown, name).toContain(`./assets/${name}.png`);
      expect(existsSync(`public/user-manual/assets/${name}.png`), name).toBe(true);
    }
  });
  it('zaznamenává původ každého veřejného screenshotu', () => {
    const manifest = JSON.parse(readFileSync('docs/user-manual/screenshots.json', 'utf8'));
    const markdown = readFileSync('public/user-manual/index.md', 'utf8');
    for (const match of markdown.matchAll(/\.\/(assets\/[a-z-]+\.png)/g)) expect(manifest.screenshots).toContain(match[1]);
    expect(manifest.data).toBe('synthetic-only');
  });
});
