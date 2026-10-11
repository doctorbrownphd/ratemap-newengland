# Tailwind CSS with custom design tokens

We use Tailwind CSS for utility styling but feed it the existing design token system (CSS custom properties from the prototype's `foundations.css`) as theme extensions. This preserves the carefully designed palette, semantic color naming, and theme variants (spruce/graphite/filament, dark mode) while replacing verbose inline React styles with scannable utility classes.

## Considered Options

- **Inline styles + foundations.css (prototype approach)**: Works but verbose, hard to scan, no responsive utilities.
- **Tailwind with default theme**: Loses the existing design language — the palette and semantic naming are better than Tailwind defaults for this domain.
