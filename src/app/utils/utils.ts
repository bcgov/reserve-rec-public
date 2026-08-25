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

  // Format phone numbers to be +12 (123) 123-1234
  static formatPhone(digits: string): string {
    let d = digits
    
    if (!d) return '';

    // Remove starting "+" if it's on there
    if (d.slice(0,1) == "+") {
      d = d.slice(1,d.length)
    }

    if (d.length <= 3) return d;
    // hyphen
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    // parenthesis and hyphen
    if (d.length <= 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    // 11 or 12 digits -> include "+" and country code
    if (d.length === 11) return `+${d.slice(0, 1)} (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 5)}) ${d.slice(5, 8)}-${d.slice(8)}`;
    return d;
  }
}
