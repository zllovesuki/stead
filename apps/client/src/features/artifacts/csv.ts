/** Parse quoted CSV fields, escaped quotes, CRLF and embedded newlines. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || field === "") quoted = !quoted;
      else field += char;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && input[i + 1] === "\n") i++;
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
