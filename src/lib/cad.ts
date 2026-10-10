import DxfParser from 'dxf-parser';
import { decodeText } from './files';

type Point = { x: number; y: number; bulge?: number };
export interface CadPath {
  points: [number, number][];
  layer: string;
  color?: number;
}
export interface CadLabel {
  x: number;
  y: number;
  text: string;
  height: number;
  rotation: number;
  layer: string;
}
export interface CadDrawing {
  paths: CadPath[];
  labels: CadLabel[];
  layers: string[];
  skipped: number;
}
type Transform = [number, number, number, number, number, number];
const identity: Transform = [1, 0, 0, 1, 0, 0];
function transform(p: Point, m: Transform): [number, number] {
  return [m[0] * p.x + m[2] * p.y + m[4], m[1] * p.x + m[3] * p.y + m[5]];
}
function multiply(a: Transform, b: Transform): Transform {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function arc(
  center: Point,
  rx: number,
  ry: number,
  start: number,
  sweep: number,
  rotation = 0,
): Point[] {
  const count = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 48)));
  if (![center.x, center.y, rx, ry, start, sweep, rotation].every(Number.isFinite) || count > 200)
    throw new Error('DXF 圆弧参数无效。');
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = start + (sweep * i) / count,
      x = rx * Math.cos(angle),
      y = ry * Math.sin(angle);
    return {
      x: center.x + x * Math.cos(rotation) - y * Math.sin(rotation),
      y: center.y + x * Math.sin(rotation) + y * Math.cos(rotation),
    };
  });
}
function polyline(vertices: Point[], closed: boolean): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    points.push(a);
    if ((!closed && i === vertices.length - 1) || !a.bulge) continue;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy),
      bulge = a.bulge;
    if (!length) continue;
    const center = {
      x: (a.x + b.x) / 2 - (dy * (1 - bulge * bulge)) / (4 * bulge),
      y: (a.y + b.y) / 2 + (dx * (1 - bulge * bulge)) / (4 * bulge),
    };
    points.push(
      ...arc(
        center,
        (length * (1 + bulge * bulge)) / (4 * Math.abs(bulge)),
        (length * (1 + bulge * bulge)) / (4 * Math.abs(bulge)),
        Math.atan2(a.y - center.y, a.x - center.x),
        4 * Math.atan(bulge),
      ).slice(1),
    );
  }
  if (closed && vertices.length) points.push(vertices[0]);
  return points;
}
export function readDxf(bytes: Uint8Array): CadDrawing {
  const text = decodeText(bytes).text;
  if (text.startsWith('AutoCAD Binary DXF'))
    throw new Error('暂不支持二进制 DXF，请导出 ASCII DXF。');
  if (text.split('\n').length > 1000000) throw new Error('DXF 超过 1,000,000 行。');
  const doc = new DxfParser().parseSync(text);
  if (!doc?.entities) throw new Error('DXF 图纸无效。');
  const paths: CadPath[] = [],
    labels: CadLabel[] = [];
  let skipped = 0,
    entities = 0,
    pointCount = 0;
  const visit = (
    items: any[],
    matrix: Transform,
    depth = 0,
    inheritedLayer = '0',
    inheritedColor?: number,
  ) => {
    for (const e of items) {
      if (++entities > 50000) throw new Error('DXF 超过 50,000 个图元。');
      const layer = e.layer && e.layer !== '0' ? e.layer : inheritedLayer;
      const definition = doc.tables?.layer?.layers?.[layer];
      if (
        e.visible === false ||
        definition?.visible === false ||
        definition?.frozen ||
        e.inPaperSpace
      )
        continue;
      const color = e.colorIndex === 0 ? inheritedColor : (e.color ?? definition?.color);
      // This viewer displays the XY model plane; other extrusion planes need a 3D CAD engine.
      if ((e.extrusionDirection?.z ?? e.extrusionDirectionZ ?? 1) !== 1) {
        skipped++;
        continue;
      }
      let points: Point[] | undefined;
      if (e.type === 'INSERT') {
        const block = doc.blocks?.[e.name];
        if (!block || depth >= 8 || (e.rowCount ?? 1) > 1 || (e.columnCount ?? 1) > 1) {
          skipped++;
          continue;
        }
        const angle = ((e.rotation ?? 0) * Math.PI) / 180,
          sx = e.xScale ?? 1,
          sy = e.yScale ?? 1;
        const local: Transform = [
          sx * Math.cos(angle),
          sx * Math.sin(angle),
          -sy * Math.sin(angle),
          sy * Math.cos(angle),
          e.position.x,
          e.position.y,
        ];
        const origin = block.position ?? { x: 0, y: 0 };
        local[4] -= local[0] * origin.x + local[2] * origin.y;
        local[5] -= local[1] * origin.x + local[3] * origin.y;
        visit(block.entities ?? [], multiply(matrix, local), depth + 1, layer, color);
        continue;
      }
      if (e.type === 'LINE') points = e.vertices;
      else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE')
        points = polyline(e.vertices ?? [], !!e.shape);
      else if (e.type === 'CIRCLE' || e.type === 'ARC') {
        const start = e.type === 'CIRCLE' ? 0 : e.startAngle;
        let sweep = e.type === 'CIRCLE' ? Math.PI * 2 : e.endAngle - start;
        if (sweep <= 0) sweep += Math.PI * 2;
        points = arc(e.center, e.radius, e.radius, start, sweep);
      } else if (e.type === 'ELLIPSE') {
        const radius = Math.hypot(e.majorAxisEndPoint.x, e.majorAxisEndPoint.y);
        let sweep = e.endAngle - e.startAngle;
        if (sweep <= 0) sweep += Math.PI * 2;
        points = arc(
          e.center,
          radius,
          radius * e.axisRatio,
          e.startAngle,
          sweep,
          Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x),
        );
      } else if (e.type === 'TEXT' || e.type === 'MTEXT') {
        const [x, y] = transform(e.startPoint ?? e.position, matrix);
        const height = (e.textHeight ?? e.height ?? 1) * Math.hypot(matrix[0], matrix[1]);
        if (![x, y, height].every(Number.isFinite) || height <= 0)
          throw new Error('DXF 文字参数无效。');
        labels.push({
          x,
          y,
          height,
          rotation: (e.rotation ?? 0) + (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI,
          layer,
          text: String(e.text ?? '')
            .replace(/\\P/g, '\n')
            .replace(/\\[A-Za-z][^;]*;/g, '')
            .replace(/[{}]/g, '')
            .slice(0, 2000),
        });
      } else {
        skipped++;
      }
      if (points?.length) {
        pointCount += points.length;
        if (pointCount > 250000) throw new Error('DXF 预览超过 250,000 个顶点。');
        const converted = points.map((p) => transform(p, matrix));
        if (converted.some((p) => !p.every(Number.isFinite))) throw new Error('DXF 包含无效坐标。');
        paths.push({ points: converted, layer, color });
      }
    }
  };
  visit(doc.entities, identity);
  if (!paths.length && !labels.length)
    throw new Error('图纸没有可预览的二维图元，可能仅包含三维实体、外部参照或不支持的图元。');
  return {
    paths,
    labels,
    layers: [...new Set([...paths.map((p) => p.layer), ...labels.map((p) => p.layer)])].sort(),
    skipped,
  };
}
