// The sole opt-in: consumers add/remove this class on #app, never via setTheme.
// It leaves preferences.theme and the html data-theme/theme-* classes untouched.
// Only Home will consume it, wired in the following dashboard enhancement.
export const HOME_DIRECTION_CLASS = "direction-evolve";
