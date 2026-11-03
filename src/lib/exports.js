export function csvDocument(headers, rows) {
  const escape = (value) => {
    let text = String(value ?? '');
    if (/^[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\ufeff' + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}

// A self-contained PDF for the frontend certificate preview; no external service.
export function certificatePdf({ name, course, number, date, status = 'Issued' }) {
  const safe = (value) =>
    String(value)
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/([\\()])/g, '\\$1');
  const lines = [
    [24, 190, 490, 'CODEEMY EDUTECH'],
    [32, 175, 415, 'Certificate of Completion'],
    [13, 290, 365, 'This recognizes'],
    [28, 220, 315, name],
    [13, 205, 270, 'for successfully completing'],
    [20, 160, 230, course],
    [11, 190, 170, `Certificate: ${number}`],
    [11, 190, 150, `Issued: ${date} | Status: ${status}`],
    [10, 190, 100, 'Frontend preview - not an accredited credential'],
  ];
  const stream =
    '0.16 0.37 0.27 RG 3 w 35 35 772 525 re S\n' +
    lines
      .map(([size, x, y, text]) => `BT /F1 ${size} Tf ${x} ${y} Td (${safe(text)}) Tj ET`)
      .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => String(offset).padStart(10, '0') + ' 00000 n ')
    .join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export function saveDownload(name, contents, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
