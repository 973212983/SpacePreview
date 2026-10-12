import { Matrix4, Vector3 } from 'three';
import { extension } from './files';
import { readModel } from './model';
import type { WorkerResult } from './worker-types';

interface OcctMesh {
  attributes: { position: { array: number[] } };
  index: { array: number[] };
  color?: number[];
}
interface OcctResult {
  success: boolean;
  meshes: OcctMesh[];
}
export interface OcctApi {
  ReadStepFile(bytes: Uint8Array, options: null): OcctResult;
  ReadIgesFile(bytes: Uint8Array, options: null): OcctResult;
  ReadBrepFile(bytes: Uint8Array, options: null): OcctResult;
}
interface AssimpNode {
  transformation: number[];
  meshes?: number[];
  children?: AssimpNode[];
}
interface AssimpScene {
  rootnode: AssimpNode;
  meshes: { vertices: number[]; faces: number[][]; materialindex: number }[];
  materials?: { properties: { key: string; value: unknown }[] }[];
}
export interface AssimpApi {
  FileList: new () => { AddFile(name: string, bytes: Uint8Array): void };
  ConvertFileList(
    files: InstanceType<AssimpApi['FileList']>,
    format: string,
  ): {
    IsSuccess(): boolean;
    FileCount(): number;
    GetErrorCode(): string;
    GetFile(index: number): { GetContent(): Uint8Array };
  };
}

export async function readExtendedModel(bytes: Uint8Array, name: string): Promise<WorkerResult> {
  const ext = extension(name);
  if (ext === 'stl' || ext === 'obj') return { positions: readModel(bytes, name) };
  if (ext === 'pcd') {
    const { PCDLoader } = await import('three/addons/loaders/PCDLoader.js');
    const cloud = new PCDLoader().parse(bytes.slice().buffer);
    try {
      const positions = Float32Array.from(cloud.geometry.getAttribute('position').array);
      const color = cloud.geometry.getAttribute('color');
      if (!positions.length || positions.some((value) => !Number.isFinite(value)))
        throw new Error('点云坐标无效。');
      return {
        positions,
        points: true,
        colors: color ? Float32Array.from(color.array) : undefined,
      };
    } finally {
      cloud.geometry.dispose();
      cloud.material.dispose();
    }
  }
  const positions: number[] = [],
    colors: number[] = [];
  const add = (vertices: number[], indices: number[], color: number[], matrix = new Matrix4()) => {
    if (indices.length % 3 || vertices.length % 3) throw new Error('模型包含无效几何数据。');
    if (positions.length + indices.length * 3 > 1_000_000 * 9)
      throw new Error('模型超过 1,000,000 个三角面。');
    const point = new Vector3();
    for (const index of indices) {
      if (!Number.isInteger(index) || index < 0 || index * 3 + 2 >= vertices.length)
        throw new Error('模型索引无效。');
      point.fromArray(vertices, index * 3).applyMatrix4(matrix);
      positions.push(point.x, point.y, point.z);
      colors.push(color[0], color[1], color[2]);
    }
  };
  if (['step', 'stp', 'iges', 'igs', 'brep'].includes(ext)) {
    const { default: initialize } = await import('occt-import-js');
    const occt = await initialize({
      locateFile: (file) => new URL(`/engines/${file}`, self.location.href).href,
    });
    const result =
      ext === 'brep'
        ? occt.ReadBrepFile(bytes, null)
        : ['iges', 'igs'].includes(ext)
          ? occt.ReadIgesFile(bytes, null)
          : occt.ReadStepFile(bytes, null);
    if (!result.success) throw new Error('工程模型解析失败。');
    for (const mesh of result.meshes)
      add(mesh.attributes.position.array, mesh.index.array, mesh.color ?? [0.72, 0.83, 0.87]);
  } else {
    const { default: initialize } = await import('assimpjs');
    const assimp = await initialize({
      locateFile: (file) => new URL(`/engines/${file}`, self.location.href).href,
    });
    const files = new assimp.FileList();
    files.AddFile(name, bytes);
    const converted = assimp.ConvertFileList(files, 'assjson');
    if (!converted.IsSuccess() || !converted.FileCount())
      throw new Error(`模型解析失败：${converted.GetErrorCode()}。多文件模型需包含内嵌几何数据。`);
    const scene: AssimpScene = JSON.parse(
      new TextDecoder().decode(converted.GetFile(0).GetContent()),
    );
    const visit = (node: AssimpNode, parent: Matrix4) => {
      const local =
        node.transformation?.length === 16
          ? new Matrix4().fromArray(node.transformation).transpose()
          : new Matrix4();
      const matrix = parent.clone().multiply(local);
      for (const index of node.meshes ?? []) {
        const mesh = scene.meshes[index];
        const diffuse = scene.materials?.[mesh.materialindex]?.properties.find(
          (item) => item.key === '$clr.diffuse',
        )?.value;
        const color =
          Array.isArray(diffuse) && diffuse.length >= 3
            ? (diffuse as number[])
            : [0.72, 0.83, 0.87];
        add(mesh.vertices, mesh.faces.filter((face) => face.length === 3).flat(), color, matrix);
      }
      for (const child of node.children ?? []) visit(child, matrix);
    };
    visit(scene.rootnode, new Matrix4());
  }
  const data = Float32Array.from(positions),
    colorData = Float32Array.from(colors);
  if (!data.length || data.some((value) => !Number.isFinite(value)))
    throw new Error('模型没有有效三角面。');
  return { positions: data, colors: colorData };
}
