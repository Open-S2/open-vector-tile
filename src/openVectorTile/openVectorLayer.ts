import { type OVectorFeature } from './openVectorFeature.js'

import type Protobuf from '../pbf.js'
import type { ColumnCacheWriter } from './columnCache.js'
import type { BaseVectorLayer } from '../baseVectorTile/index.js'

export default class OVectorLayer {
  name: string = ''
  features: OVectorFeature[] = []
  constructor () {}
}

// TODO: write either a baseVectorLayer or VectorLayer
// extent (encoded as 1 -> 1024, 2 -> 2048, 3 -> 4096, 4 -> 8192).
// name is an index to the columns table
// features are the same as the past version
export function write (
  layer: BaseVectorLayer,
  cache: ColumnCacheWriter,
  pbf: Protobuf
): void {
}
