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
}
