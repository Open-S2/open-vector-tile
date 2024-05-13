import Protobuf from "./pbf";
import { ColumnCacheReader, MapboxVectorLayer, OVectorLayer } from "./index";

type Layers = Record<string, MapboxVectorLayer | OVectorLayer>;

export default class VectorTile {
  #columns!: ColumnCacheReader;
  layers: Layers = {};
  constructor(data: Uint8Array, end = 0) {
    const pbf = new Protobuf(data);
    pbf.readFields(this.readTile.bind(this), this, end);
  }

  readTile(tag: number, vectorTile: VectorTile, pbf: Protobuf): void {
    if (tag === 1 || tag === 3) {
      const layer = new MapboxVectorLayer(pbf, pbf.readVarint() + pbf.pos, tag === 1);
      if (layer.length !== 0) vectorTile.layers[layer.name] = layer;
    } else if (tag === 4) {
      this.#columns = new ColumnCacheReader(pbf, pbf.readVarint() + pbf.pos);
    } else if (tag === 5) {
      const layer = new OVectorLayer(pbf, pbf.readVarint() + pbf.pos, this.#columns);
      vectorTile.layers[layer.name] = layer;
    }
  }
}
