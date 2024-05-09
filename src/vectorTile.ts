import Protobuf from "./pbf";
import { ColumnCacheReader } from "./openVectorTile/columnCache";
import VectorTileLayer from "./oldVectorTile/vectorLayer";

type Layers = Record<string, VectorTileLayer>;

export default class VectorTile {
  #columns!: ColumnCacheReader;
  layers: Layers = {};
  constructor(data: Uint8Array, end = 0) {
    const pbf = new Protobuf(data);
    pbf.readFields(this.readTile.bind(this), this, end);
  }

  readTile(tag: number, vectorTile: VectorTile, pbf: Protobuf): void {
    // TODO: implement OpenVectorTile columns, layers
    if (tag === 1 || tag === 3) {
      const layer = new VectorTileLayer(
        pbf,
        pbf.readVarint() + pbf.pos,
        tag === 1,
      );
      if (layer.length !== 0) vectorTile.layers[layer.name] = layer;
    } else if (tag === 5) {
      this.#columns = new ColumnCacheReader(pbf, pbf.readVarint() + pbf.pos);
    }
  }
}
