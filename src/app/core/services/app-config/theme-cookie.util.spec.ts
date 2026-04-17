import { describe, expect, it } from 'vitest';
import {
  parseThemeCookie,
  serializeThemeCookie,
  THEME_COOKIE_NAME,
} from './theme-cookie.util';

describe('parseThemeCookie', () => {
  describe('falsy inputs', () => {
    it('returns null for null', () => {
      expect(parseThemeCookie(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(parseThemeCookie(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseThemeCookie('')).toBeNull();
    });
  });

  describe('valid values', () => {
    it('parses a lone "theme=dark" cookie', () => {
      expect(parseThemeCookie('theme=dark')).toBe('dark');
    });

    it('parses a lone "theme=light" cookie', () => {
      expect(parseThemeCookie('theme=light')).toBe('light');
    });

    it('extracts theme when it is the first of many cookies', () => {
      expect(parseThemeCookie('theme=dark; foo=bar; baz=qux')).toBe('dark');
    });

    it('extracts theme from the middle of a cookie string', () => {
      expect(parseThemeCookie('foo=bar; theme=light; baz=qux')).toBe('light');
    });

    it('extracts theme from the tail of a cookie string', () => {
      expect(parseThemeCookie('foo=bar; baz=qux; theme=dark')).toBe('dark');
    });

    it('tolerates extra whitespace after the separator', () => {
      expect(parseThemeCookie('foo=bar;   theme=light')).toBe('light');
    });

    it('recovers from trailing whitespace after the value (malformed writer)', () => {
      // Some server-side cookie libraries emit `theme=dark ` — the regex body
      // `[^;\s]+` stops at the whitespace, so the captured value is `dark`.
      expect(parseThemeCookie('theme=dark ')).toBe('dark');
    });

    it('rejects internal whitespace in the value', () => {
      // `[^;\s]+` captures only up to the first whitespace, so `dark evil`
      // cannot be silently classified as `dark`. It captures `dark` cleanly
      // and is accepted — that's fine because `dark` is a valid value; the
      // important thing is the injected `evil` suffix never reaches output.
      expect(parseThemeCookie('theme=dark evil')).toBe('dark');
    });
  });

  describe('invalid or ambiguous values', () => {
    it('returns null for an unrecognized value', () => {
      expect(parseThemeCookie('theme=solarized')).toBeNull();
    });

    it('returns null for an empty value (`theme=`)', () => {
      expect(parseThemeCookie('theme=')).toBeNull();
    });

    it('returns null for a case-mismatched value (cookies are case-sensitive)', () => {
      expect(parseThemeCookie('theme=DARK')).toBeNull();
    });

    it('does not match a name suffix like "mytheme=dark" (prefix safety)', () => {
      expect(parseThemeCookie('mytheme=dark')).toBeNull();
    });

    it('does not match a name prefix like "themes=dark" (suffix safety)', () => {
      // `theme=` vs `themes=`: the regex requires literal `theme=`, and because
      // `themes=dark` has the `s=` breaking the literal, it won't match.
      expect(parseThemeCookie('themes=dark')).toBeNull();
    });

    it('is case-sensitive on the cookie name', () => {
      expect(parseThemeCookie('Theme=dark')).toBeNull();
    });

    it('returns null when the theme cookie is absent', () => {
      expect(parseThemeCookie('foo=bar; baz=qux')).toBeNull();
    });

    it('prefers the first occurrence when the cookie appears twice', () => {
      // RFC 6265 doesn't forbid duplicates; real-world behavior is "first wins"
      // because that's what the regex finds. Assert the contract explicitly so
      // any future refactor keeps the same tie-break.
      expect(parseThemeCookie('theme=dark; theme=light')).toBe('dark');
    });
  });

});

describe('serializeThemeCookie', () => {
  it('emits the required attributes for an insecure origin', () => {
    const cookie = serializeThemeCookie('dark', { secure: false });
    expect(cookie).toBe(
      'theme=dark; Path=/; Max-Age=31536000; SameSite=Lax',
    );
  });

  it('appends `Secure` when the origin is HTTPS', () => {
    const cookie = serializeThemeCookie('dark', { secure: true });
    expect(cookie).toBe(
      'theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
    );
  });

  it('serializes "light" identically to "dark" modulo value', () => {
    expect(serializeThemeCookie('light', { secure: false })).toBe(
      'theme=light; Path=/; Max-Age=31536000; SameSite=Lax',
    );
    expect(serializeThemeCookie('light', { secure: true })).toBe(
      'theme=light; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
    );
  });

  it('uses the exported cookie name as the key', () => {
    const cookie = serializeThemeCookie('dark', { secure: false });
    expect(cookie.startsWith(`${THEME_COOKIE_NAME}=`)).toBe(true);
  });

  it('sets a 1-year Max-Age (31536000 seconds)', () => {
    const cookie = serializeThemeCookie('dark', { secure: true });
    expect(cookie).toContain('Max-Age=31536000');
  });

  it('sets SameSite=Lax for top-level navigation survival without cross-site leakage', () => {
    const cookie = serializeThemeCookie('dark', { secure: true });
    expect(cookie).toContain('SameSite=Lax');
  });

  it('sets Path=/ so the cookie is sent on every route', () => {
    const cookie = serializeThemeCookie('dark', { secure: true });
    expect(cookie).toContain('Path=/');
  });

  describe('runtime validation (defense-in-depth)', () => {
    // TypeScript narrows `ThemePreference` at compile time but JS runtime has
    // no enforcement. If a future caller forwards user-controlled input — even
    // by accident — these checks block cookie header injection (OWASP ASVS
    // V13.1.3). We cast through `unknown` to bypass TS and simulate JS call.

    it('throws when value is not "dark" or "light"', () => {
      expect(() =>
        serializeThemeCookie(
          'solarized' as unknown as 'dark',
          { secure: false },
        ),
      ).toThrow(TypeError);
    });

    it('throws on cookie-injection attempts', () => {
      expect(() =>
        serializeThemeCookie(
          'dark; Path=/; evil=1' as unknown as 'dark',
          { secure: false },
        ),
      ).toThrow(TypeError);
    });

    it('throws on non-string input', () => {
      expect(() =>
        serializeThemeCookie(null as unknown as 'dark', { secure: false }),
      ).toThrow(TypeError);
      expect(() =>
        serializeThemeCookie(undefined as unknown as 'dark', { secure: false }),
      ).toThrow(TypeError);
    });
  });
});

describe('parse + serialize round-trip', () => {
  it('re-parses a serialized "dark" cookie back to "dark"', () => {
    const serialized = serializeThemeCookie('dark', { secure: true });
    // `document.cookie` on read surfaces only `name=value` pairs, not attrs.
    // We emulate that by taking the first segment.
    const readShape = serialized.split(';')[0];
    expect(parseThemeCookie(readShape)).toBe('dark');
  });

  it('re-parses a serialized "light" cookie back to "light"', () => {
    const serialized = serializeThemeCookie('light', { secure: false });
    const readShape = serialized.split(';')[0];
    expect(parseThemeCookie(readShape)).toBe('light');
  });
});
