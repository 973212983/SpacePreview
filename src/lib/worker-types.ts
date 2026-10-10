export interface ArchiveEntry {
  name: string;
  size: number;
  compressed: number;
  directory: boolean;
  index: number;
  offset?: number;
  method?: number;
  encrypted?: boolean;
  crc?: number;
}
export interface WorkerRequest {
  encoding?: import('./files').TextEncoding;
  partial?: boolean;
  kind:
    | 'text'
    | 'markdown'
    | 'archive'
    | 'archive-entry'
    | 'archive-directory'
    | 'archive-data'
    | 'docx'
    | 'xlsx'
    | 'pptx'
    | 'csv'
    | 'odt'
    | 'ods'
    | 'odp'
    | 'epub'
    | 'html'
    | 'fb2'
    | 'notebook'
    | 'dxf'
    | 'model'
    | 'tiff'
    | 'docx-layout';
  name: string;
  bytes: Uint8Array;
  entryName?: string;
  entry?: ArchiveEntry;
  count?: number;
  page?: number;
}
export interface WorkbookSheet {
  name: string;
  rows: string[][];
  columns: number;
  truncated: boolean;
}
export interface WorkerResult {
  text?: string;
  html?: string;
  encoding?: string;
  language?: string;
  lines?: number;
  entries?: ArchiveEntry[];
  truncated?: boolean;
  sheets?: WorkbookSheet[];
  slides?: { title: string; paragraphs: string[] }[];
  data?: Uint8Array;
  chapters?: { title: string; html: string }[];
  note?: string;
  drawing?: import('./cad').CadDrawing;
  positions?: Float32Array;
  raster?: { width: number; height: number; pixels: Uint8Array; pages: number; page: number };
}
