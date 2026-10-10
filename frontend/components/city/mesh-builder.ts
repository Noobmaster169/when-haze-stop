import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

/**
 * Collects flat-shaded triangles into one geometry, so ten thousand buildings
 * draw in a single call. Each triangle is turned to face the normal it is
 * given, so callers never think about winding.
 */

export type Linear = [number, number, number];

const ab = new Vector3();
const ac = new Vector3();

export class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colours: number[] = [];

  triangle(a: Vector3, b: Vector3, c: Vector3, normal: Vector3, colour: Linear): void {
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    const facing = ab.cross(ac).dot(normal) >= 0;
    const [second, third] = facing ? [b, c] : [c, b];
    for (const point of [a, second, third]) {
      this.positions.push(point.x, point.y, point.z);
      this.normals.push(normal.x, normal.y, normal.z);
      this.colours.push(colour[0], colour[1], colour[2]);
    }
  }

  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, normal: Vector3, colour: Linear): void {
    this.triangle(a, b, c, normal, colour);
    this.triangle(a, c, d, normal, colour);
  }

  /** Adds a geometry made elsewhere, such as a lathe, in one colour. */
  absorb(geometry: BufferGeometry, colour: Linear): void {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = flat.getAttribute("position");
    const normal = flat.getAttribute("normal");
    for (let index = 0; index < position.count; index++) {
      this.positions.push(position.getX(index), position.getY(index), position.getZ(index));
      this.normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      this.colours.push(colour[0], colour[1], colour[2]);
    }
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(this.colours, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }
}
