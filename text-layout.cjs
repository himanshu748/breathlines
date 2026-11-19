function wrapText(text, width, measure) {
  const rows = [];
  let row = '';
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const candidate = row ? `${row} ${word}` : word;
    if (measure(candidate) <= width) {
      row = candidate;
      continue;
    }
    if (row) rows.push(row);
    row = '';
    for (const char of word) {
      if (row && measure(row + char) > width) {
        rows.push(row);
        row = '';
      }
      row += char;
    }
  }
  if (row) rows.push(row);
  return rows;
}

module.exports = { wrapText };
