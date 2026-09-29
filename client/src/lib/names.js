// client/src/lib/names.js

/**
 * How to address someone in a greeting or a menu. A title stays with
 * the surname ("Dr. Ama Boateng" → "Dr. Boateng") instead of being
 * mistaken for a first name ("Dr."); everyone else is their first
 * name ("Adwoa Owusu" → "Adwoa").
 */
const TITLE = /^(dr|prof|professor|mr|mrs|ms|miss|mx|rev|sir|madam|engr|ing)\.?$/i;

export function shortName(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length > 1 && TITLE.test(parts[0])) {
    const title = parts[0].replace(/\.?$/, '.');
    return `${title[0].toUpperCase()}${title.slice(1)} ${parts[parts.length - 1]}`;
  }
  return parts[0];
}

// For "Hi, Adwoa." style headlines: adds the full stop unless the
// name already ends with one.
export const withStop = (s) => (s && !/[.!?]$/.test(s) ? `${s}.` : s);

// "CS301 Databases", unless the name already starts with its code.
export const classLabel = (code, name) =>
  (name && code && name.toUpperCase().startsWith(code.toUpperCase()) ? name : [code, name].filter(Boolean).join(' '));
