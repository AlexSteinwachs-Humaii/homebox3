# Home visual foundation

`layouts/default.vue` adds `home-presentation` only while the route is `/home` (including a trailing slash). It changes inherited tokens, not the user's stored theme or the global theme definitions. Removing the class restores the selected theme. Do not attach it to `body` or a persistent theme container.

The same reactive class is passed explicitly to the Create dropdown, the collection selector popover (`presentationClass` prop), and the mobile sidebar Sheet (`mobileContentClass` prop). New teleported Home surfaces must opt in explicitly; unrelated dialogs retain their shared presentation.

## Reusable, opt-in classes

Use these **inside** a `home-presentation` scope. They do not replace shared UI variants or introduce new data/content.

- `home-surface`: white, flat, subtly bordered panel with 4px corners.
- `home-section`: section spacing and top divider; `home-section-title`: sans-serif section heading.
- `home-action`: purple filled action; add `home-action-outline` for a white/purple secondary action. Apply to a semantic button or link, not a clickable div. Keep existing accessible labels, disabled states and event handlers.
- `home-statistic`: bordered card with a purple top rule; `home-statistic-value`: tabular purple figure. Add `home-statistic-featured` to the card for white text on purple.
- `home-headline`: the **reserved editorial headline**, Georgia/system serif; all other UI inherits Arial/system sans-serif.
- `home-eyebrow`: small purple uppercase context label.
- `home-muted`: readable secondary copy (also white inside featured statistics).

Example for the subsequent dashboard work:

```html
<section class="home-section" aria-labelledby="stats-title">
  <h2 id="stats-title" class="home-section-title">…localized section title…</h2>
  <article class="home-statistic">
    <p class="home-muted">…localized label…</p>
    <p class="home-statistic-value">…real formatted value…</p>
  </article>
</section>
```

Named `--home-*` tokens are available for additional opt-in treatments. Existing semantic HSL token pairs are overridden together so components do not inherit a dark theme's foreground onto light Home surfaces. Focus has a purple outline and white separation, with a system-color outline in forced-colors mode. No remote fonts or branded assets are required.

`test/e2e/home-shell.browser.spec.ts` tests the actual compiled stylesheet in an isolated browser fixture, including two selected themes, scope removal/reapplication, a portal scope, typography, keyboard focus and semantic contrast. This foundation fixture does not validate real route navigation, authentication, permissions or shell interactions; those belong to the following shell stories.
