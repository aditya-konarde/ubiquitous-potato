import {
  injectAnimationCSS,
  removeAnimationCSS,
  applyStaggeredEntrance,
  ANIM_TOKENS,
} from '@/content/modules/animation-system';

const STYLE_ID = 'simply-mail-animation-system';

describe('animation-system', () => {
  afterEach(() => {
    removeAnimationCSS();
  });

  describe('injectAnimationCSS', () => {
    it('injects a style element with the expected ID', () => {
      injectAnimationCSS();

      const style = document.getElementById(STYLE_ID) as HTMLStyleElement;
      expect(style).not.toBeNull();
      expect(style.tagName).toBe('STYLE');
    });

    it('includes CSS custom properties on :root', () => {
      injectAnimationCSS();

      const style = document.getElementById(STYLE_ID) as HTMLStyleElement;
      const css = style.textContent ?? '';

      expect(css).toContain('--simply-mail-spring-curve:');
      expect(css).toContain('--simply-mail-ease-out-curve:');
      expect(css).toContain('--simply-mail-duration-normal:');
      expect(css).toContain('--simply-mail-duration-fast:');
      expect(css).toContain('--simply-mail-stagger-delay:');
    });

    it('includes all five @keyframes', () => {
      injectAnimationCSS();

      const style = document.getElementById(STYLE_ID) as HTMLStyleElement;
      const css = style.textContent ?? '';

      expect(css).toContain('@keyframes simply-mail-fade-in');
      expect(css).toContain('@keyframes simply-mail-slide-up');
      expect(css).toContain('@keyframes simply-mail-slide-right');
      expect(css).toContain('@keyframes simply-mail-scale-in');
      expect(css).toContain('@keyframes simply-mail-shimmer');
    });

    it('includes prefers-reduced-motion override', () => {
      injectAnimationCSS();

      const style = document.getElementById(STYLE_ID) as HTMLStyleElement;
      const css = style.textContent ?? '';

      expect(css).toContain('prefers-reduced-motion');
    });

    it('is idempotent — calling twice does not create duplicate elements', () => {
      injectAnimationCSS();
      injectAnimationCSS();

      const styles = document.querySelectorAll(`#${STYLE_ID}`);
      expect(styles.length).toBe(1);
    });
  });

  describe('removeAnimationCSS', () => {
    it('removes the injected style element', () => {
      injectAnimationCSS();
      expect(document.getElementById(STYLE_ID)).not.toBeNull();

      removeAnimationCSS();
      expect(document.getElementById(STYLE_ID)).toBeNull();
    });

    it('does not throw when no style element exists', () => {
      expect(() => removeAnimationCSS()).not.toThrow();
    });
  });

  describe('ANIM_TOKENS', () => {
    it('exposes expected token keys', () => {
      expect(ANIM_TOKENS).toHaveProperty('springCurve');
      expect(ANIM_TOKENS).toHaveProperty('easeOutCurve');
      expect(ANIM_TOKENS).toHaveProperty('durationNormal');
      expect(ANIM_TOKENS).toHaveProperty('durationFast');
      expect(ANIM_TOKENS).toHaveProperty('staggerDelay');
    });

    it('springCurve is a cubic-bezier', () => {
      expect(ANIM_TOKENS.springCurve).toMatch(/^cubic-bezier\(/);
    });
  });

  describe('applyStaggeredEntrance', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="parent">
          <div class="child">A</div>
          <div class="child">B</div>
          <div class="child">C</div>
        </div>
      `;
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('returns all matched children', () => {
      const parent = document.getElementById('parent')!;
      const result = applyStaggeredEntrance(parent, '.child');

      expect(result.length).toBe(3);
    });

    it('applies simply-mail-slide-up animation to each child', () => {
      const parent = document.getElementById('parent')!;
      applyStaggeredEntrance(parent, '.child');

      const children = parent.querySelectorAll('.child');
      children.forEach((child) => {
        const style = (child as HTMLElement).style;
        expect(style.animation).toContain('simply-mail-slide-up');
      });
    });

    it('applies increasing animation-delay to children', () => {
      const parent = document.getElementById('parent')!;
      applyStaggeredEntrance(parent, '.child', 50);

      const children = parent.querySelectorAll('.child');
      expect((children[0] as HTMLElement).style.animationDelay).toBe('0ms');
      expect((children[1] as HTMLElement).style.animationDelay).toBe('50ms');
      expect((children[2] as HTMLElement).style.animationDelay).toBe('100ms');
    });

    it('uses default stagger delay when not specified', () => {
      const parent = document.getElementById('parent')!;
      applyStaggeredEntrance(parent, '.child');

      const children = parent.querySelectorAll('.child');
      expect((children[1] as HTMLElement).style.animationDelay).toBe(`${ANIM_TOKENS.staggerDelay}ms`);
    });

    it('injects animation CSS if not already present', () => {
      expect(document.getElementById(STYLE_ID)).toBeNull();

      const parent = document.getElementById('parent')!;
      applyStaggeredEntrance(parent, '.child');

      expect(document.getElementById(STYLE_ID)).not.toBeNull();
    });

    it('returns empty array when no children match', () => {
      const parent = document.getElementById('parent')!;
      const result = applyStaggeredEntrance(parent, '.nonexistent');

      expect(result).toEqual([]);
    });
  });
});
