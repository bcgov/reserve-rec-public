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
}
