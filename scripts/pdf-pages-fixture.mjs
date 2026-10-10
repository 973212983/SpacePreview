import { mkdir, writeFile } from 'node:fs/promises';

const count = 40;
const outlineId = 4 + count * 2;
const objects = [
  `<< /Type /Catalog /Pages 2 0 R /Outlines ${outlineId} 0 R >>`,
  `<< /Type /Pages /Kids [${Array.from({ length: count }, (_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${count} >>`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
for (let i = 0; i < count; i++) {
  const size = i === count - 1 ? '2000 3000' : i % 2 ? '792 612' : '612 792';
  const rotation = i >= 2 && i <= 4 ? `/Rotate ${(i - 1) * 90}` : '';
  const content = `0.1 0.4 0.8 rg 60 400 400 80 re f BT /F1 24 Tf 72 520 Td (CONTINUOUS_PAGE_${i + 1}) Tj ET`;
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size}] ${rotation} /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  );
}
objects.push(
  `<< /Type /Outlines /First ${outlineId + 1} 0 R /Last ${outlineId + 1} 0 R /Count 1 >>`,
  `<< /Title (Saved last page) /Parent ${outlineId} 0 R /Dest [${4 + (count - 1) * 2} 0 R /Fit] >>`,
);
let pdf = '%PDF-1.4\n';
const offsets = [0];
for (const [index, object] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
pdf += offsets
  .slice(1)
  .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
  .join('');
pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
await mkdir(new URL('../test-results/fixtures/', import.meta.url), { recursive: true });
export const fixture = new URL('../test-results/fixtures/continuous-pages.pdf', import.meta.url);
await writeFile(fixture, pdf);
