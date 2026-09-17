export function getShortName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;

  const firstName = parts.slice(0, -1).join(' ');
  const lastName = parts[parts.length - 1];
  const lastInitial = lastName[0] ? lastName[0].toUpperCase() : '';
  return lastInitial ? `${firstName} ${lastInitial}` : name;
}

export function isNameMatch(existingName: string, scrapedName: string): boolean {
  const ext = existingName.trim().toLowerCase().replace(/\.$/, ''); // e.g. "max m"
  const scr = scrapedName.trim().toLowerCase(); // e.g. "max mustermann"
  if (ext === scr) return true;

  const extParts = ext.split(/\s+/);
  const scrParts = scr.split(/\s+/);
  if (extParts.length === 0 || scrParts.length === 0) return false;

  const lastExtPart = extParts[extParts.length - 1];
  if (lastExtPart.length === 1) {
    const prefixExt = extParts.slice(0, -1).join(' ');
    const prefixScr = scrParts.slice(0, extParts.length - 1).join(' ');
    const correspondingScrPart = scrParts[extParts.length - 1] || '';
    if (prefixExt === prefixScr && correspondingScrPart.startsWith(lastExtPart)) {
      return true;
    }
  }
  return false;
}
