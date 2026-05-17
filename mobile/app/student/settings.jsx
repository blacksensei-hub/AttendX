// This file exists only so expo-router doesn't complain about the
// "settings" tab referenced in student/_layout.jsx having no
// matching route. The tab intercepts its own press and opens a
// popover instead of navigating here — so this screen is never
// actually rendered.
export default function SettingsPlaceholder() {
  return null;
}