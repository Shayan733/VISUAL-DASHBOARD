import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Sanitize, escapeHtml } from '../js/sanitize.js';

const here = dirname(fileURLToPath(import.meta.url));
const loadTemplate = (name) =>
  JSON.parse(readFileSync(join(here, '..', 'templates', `${name}-template.json`), 'utf8'));

/* ── XSS payload corpus ── */

const XSS_PAYLOADS = [
  `"><img src=x onerror=alert(1)>`,
  `'><script>alert(1)</script>`,
  `<svg/onload=alert(1)>`,
  `javascript:alert(1)`,
  `"onmouseover="alert(1)`,
  `</textarea><script>alert(1)</script>`,
];

describe('escapeHtml', () => {
  it('neutralizes every payload in the corpus', () => {
    for (const payload of XSS_PAYLOADS) {
      const escaped = escapeHtml(payload);
      expect(escaped).not.toMatch(/[<>]/);
      expect(escaped).not.toContain('"');
      expect(escaped).not.toContain("'");
    }
  });

  it('escapes ampersands (the bug in the old escapeAttr)', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });

  it('handles null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('sanitizeColor', () => {
  it('accepts valid hex colors', () => {
    expect(Sanitize.sanitizeColor('#818cf8')).toBe('#818cf8');
    expect(Sanitize.sanitizeColor('#fff')).toBe('#fff');
    expect(Sanitize.sanitizeColor('#FFAA0080')).toBe('#FFAA0080');
  });

  it('prefixes bare hex (legacy template colors)', () => {
    expect(Sanitize.sanitizeColor('534AB7')).toBe('#534AB7');
  });

  it('rejects every XSS payload with the fallback', () => {
    for (const payload of XSS_PAYLOADS) {
      expect(Sanitize.sanitizeColor(payload)).toBe('#818cf8');
    }
  });

  it('rejects style-breakout values', () => {
    expect(Sanitize.sanitizeColor('red;background:url(javascript:1)')).toBe('#818cf8');
    expect(Sanitize.sanitizeColor('"></div><script>1</script>')).toBe('#818cf8');
    expect(Sanitize.sanitizeColor(123)).toBe('#818cf8');
  });

  it('honors a custom fallback', () => {
    expect(Sanitize.sanitizeColor(null, '#fbbf24')).toBe('#fbbf24');
  });
});

describe('sanitizeUrl', () => {
  it('accepts http/https', () => {
    expect(Sanitize.sanitizeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(Sanitize.sanitizeUrl('http://example.com')).toBe('http://example.com/');
  });

  it('rejects javascript:, data:, and garbage', () => {
    expect(Sanitize.sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(Sanitize.sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(Sanitize.sanitizeUrl('not a url')).toBeNull();
    expect(Sanitize.sanitizeUrl('')).toBeNull();
    expect(Sanitize.sanitizeUrl(null)).toBeNull();
  });
});

/* ── State validation ── */

describe('validateState', () => {
  it('returns an empty state for junk input', () => {
    for (const junk of [null, undefined, 'string', 42, [], { nodes: 'nope' }]) {
      const s = Sanitize.validateState(junk);
      expect(s.nodes).toEqual([]);
      expect(s.connections).toEqual([]);
      expect(s.canvas.zoom).toBe(1);
    }
  });

  it('sanitizes malicious colors and URLs inside nodes', () => {
    const s = Sanitize.validateState({
      nodes: [{
        id: 'n1',
        type: 'node',
        label: '<script>x</script>',
        color: '"><img src=x onerror=alert(1)>',
        attachments: [
          { id: 'a1', name: 'evil', attachmentType: 'link', url: 'javascript:alert(1)', ogImage: 'javascript:alert(2)' },
        ],
      }],
      connections: [],
    });
    expect(s.nodes[0].color).toBe('#818cf8');
    // Label kept as data (escaping happens at render) but structure intact
    expect(s.nodes[0].label).toBe('<script>x</script>');
    expect(s.nodes[0].attachments[0].url).toBeNull();
    expect(s.nodes[0].attachments[0].ogImage).toBeNull();
  });

  it('drops connections to missing nodes and self-loops', () => {
    const s = Sanitize.validateState({
      nodes: [{ id: 'a' }, { id: 'b' }],
      connections: [
        { id: 'ok', sourceId: 'a', targetId: 'b' },
        { id: 'ghost', sourceId: 'a', targetId: 'zzz' },
        { id: 'self', sourceId: 'a', targetId: 'a' },
      ],
    });
    expect(s.connections.map(c => c.id)).toEqual(['ok']);
    expect(s.connections[0].sourcePort).toBe('right');
    expect(s.connections[0].targetPort).toBe('left');
  });

  it('clears dangling parentIds and clamps zoom', () => {
    const s = Sanitize.validateState({
      canvas: { offsetX: 'NaN', offsetY: 5, zoom: 999 },
      nodes: [{ id: 'child', parentId: 'gone' }],
    });
    expect(s.nodes[0].parentId).toBeNull();
    expect(s.canvas.offsetX).toBe(0);
    expect(s.canvas.zoom).toBe(5);
  });
});

/* ── Legacy template migration ── */

describe('legacy template migration', () => {
  for (const name of ['workflow', 'planning', 'system']) {
    it(`migrates the real ${name} template to the current schema`, () => {
      const raw = loadTemplate(name);
      const s = Sanitize.validateState(raw);

      // Every node must have a renderable type
      for (const n of s.nodes) {
        expect(['node', 'group', 'sticky']).toContain(n.type);
        // Colors are #-prefixed hex or default
        expect(n.color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
        // Statuses use current keys ('progress', never 'in-progress')
        expect([null, 'todo', 'progress', 'done', 'blocked']).toContain(n.status);
      }

      // Nothing from the source file was dropped
      const sourceGroups = (raw.groups || []).length;
      const sourceNodes = (raw.nodes || []).length;
      expect(s.nodes.filter(n => n.type === 'group')).toHaveLength(sourceGroups);
      expect(s.nodes).toHaveLength(sourceGroups + sourceNodes);
      expect(s.connections).toHaveLength((raw.connections || []).length);

      // Connections point at real nodes
      const ids = new Set(s.nodes.map(n => n.id));
      for (const c of s.connections) {
        expect(ids.has(c.sourceId)).toBe(true);
        expect(ids.has(c.targetId)).toBe(true);
      }
    });
  }

  it('converts groupId to parentId with parent-relative coordinates', () => {
    const s = Sanitize.validateState({
      nodes: [{ id: 'n1', label: 'X', groupId: 'g1', x: 100, y: 100 }],
      groups: [{ id: 'g1', label: 'G', x: 50, y: 50, width: 500, height: 200 }],
    });
    const child = s.nodes.find(n => n.id === 'n1');
    expect(child.parentId).toBe('g1');
    expect(child.x).toBe(50); // 100 absolute − 50 group origin
    expect(child.y).toBe(50);
  });

  it('maps in-progress → progress', () => {
    const s = Sanitize.validateState({ nodes: [{ id: 'n1', status: 'in-progress' }] });
    expect(s.nodes[0].status).toBe('progress');
  });
});
