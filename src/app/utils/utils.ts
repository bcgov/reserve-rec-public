import { formatInternationalPhone, normalizePhone } from './phone-utils';

export class Utils {
  buildInnerHTMLRow(arr): string {
    let str = `<div class="row">`;
    let columns = '';
    for (const column of arr) {
      columns += `<div class="col mb-4">${column}</div>`;
    }
    str += columns + `</div>`;
    return str;
  }

  static formatMapCoords(item: { sk: any; entryPoint: any; coordinates: any; location: { type: any; }; }) {
    // Only create map object if we have the necessary data
    if (!item.coordinates && !item.location) {
      console.warn('No coordinates or location data available for map');
      return null;
    }
    
    return {
      _id: item.sk,
      displayName: item.entryPoint,
      imageUrl: "", // TODO
      coordinates: item.coordinates,
      type: item.location.type,
      location: item.location
    }
  }

  // (250) 555-1234 or +1 (250) 555-1234 for Canada and the US, +44 7911 123456 elsewhere
  static formatPhone(value: string): string {
    if (!value) return '';

    // Strip punctuation so stored values like "250-555-0123" or "+1 (250) 555-0123"
    // format from their digits rather than slicing separators into the mask.
    const d = String(value).replace(/\D/g, '');
    if (!d) return '';

    const e164 = normalizePhone(value);
    if (e164 && !e164.startsWith('+1')) return formatInternationalPhone(e164);
    if (e164 && d.length === 11) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    // Keep a typed +: without it an international number reads as a Canadian one.
    if (String(value).trim().startsWith('+')) return `+${d}`;
    if (d.length <= 3) return d;
    // hyphen
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    // parenthesis and hyphen
    if (d.length <= 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return d;
  }
}
