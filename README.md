# open-vector-tile ![GitHub Actions Workflow Status][test-workflow] [![npm][npm-image]][npm-url] [![crate][crate-image]][crate-url] [![downloads][downloads-image]][downloads-url] [![bundle][bundle-image]][bundle-url] [![docs-ts][docs-ts-image]][docs-ts-url] [![docs-rust][docs-rust-image]][docs-rust-url] ![doc-coverage][doc-coverage-image] ![code-coverage][code-coverage-image] [![Discord][discord-image]][discord-url]

[test-workflow]: https://img.shields.io/github/actions/workflow/status/Open-S2/open-vector-tile/test.yml?logo=github
[npm-image]: https://img.shields.io/npm/v/open-vector-tile.svg?logo=npm&logoColor=white
[npm-url]: https://npmjs.org/package/open-vector-tile
[crate-image]: https://img.shields.io/crates/v/open-vector-tile.svg?logo=rust&logoColor=white
[crate-url]: https://crates.io/crates/open-vector-tile
[bundle-image]: https://img.shields.io/bundlejs/size/open-vector-tile?exports=VectorTile
[bundle-url]: https://bundlejs.com/?q=open-vector-tile&treeshake=%5B%7B+VectorTile+%7D%5D
[downloads-image]: https://img.shields.io/npm/dm/open-vector-tile.svg
[downloads-url]: https://www.npmjs.com/package/open-vector-tile
[docs-ts-image]: https://img.shields.io/badge/docs-typescript-yellow.svg
[docs-ts-url]: https://open-s2.github.io/open-vector-tile/
[docs-rust-image]: https://img.shields.io/badge/docs-rust-yellow.svg
[docs-rust-url]: https://docs.rs/open-vector-tile
[doc-coverage-image]: https://raw.githubusercontent.com/Open-S2/open-vector-tile/master/assets/doc-coverage.svg
[code-coverage-image]: https://raw.githubusercontent.com/Open-S2/open-vector-tile/master/assets/code-coverage.svg
[discord-image]: https://img.shields.io/discord/953563031701426206?logo=discord&logoColor=white
[discord-url]: https://discord.opens2.com

## About

A Modified TypeScript implementation of the [Mapbox Vector Tile](https://github.com/mapbox/vector-tile-js) library. It is backwards compatible but offers a lot of new features and improvements including (but not limited to):

* 🔗 lightweight zero dependency builds.
* 🌴 Proper module treeshake.
* 🦺 Complete TypeScript support / safety.
* 🗜 Pre-Tessellated & Indexed geometries to quickly ship data to the renderer.
* 🧊 Support for 3D geometries.
* ♏ Support for M-Values for each geometry point (used by lines and polygons).
* ♻️ Feature Properties & M-Values are stored as "Shapes" which reuses objects only needing to do lookups on values.
* 🏛 Column encoding of data to make it more compact. Better gzip and brotli compression.
* 🪺 Support nested objects in properties and m-values.
* 📦 All features support first class citizen `BBOX` data like IDs.
* 😑 Lines support `offsets` to know the distance it's traveled (useful for rendering dashed lines).

## Inspiration

A very talented [Markus Tremmel](https://github.com/mactrem) came up with the idea of migrating away from a row based approach to a column based approach with his [COVTiles](https://github.com/mactrem/cov-tiles). I wanted to test the idea of simplifying his approach and see if it was worth the effort. Once I saw brotli compression had comperable results, I decided to finish the project.

## Read The Spec

[open-vector-tile-spec](/vector-tile-spec/1.0.0/README.md)

## Install

```bash
#bun
bun add open-vector-tile
# pnpm
pnpm add open-vector-tile
# yarn
yarn add open-vector-tile
# npm
npm install open-vector-tile

# cargo
cargo install open-vector-tile
```

### Example use

```ts
const fs = from 'fs'
import { VectorTile } from 'open-vector-tile'

// assume you can read (.pbf | .mvt | .ovt)
const fixture = fs.readFileSync('./x-y-z.vector.pbf')
// Bun const fixture = new Uint8Array(await Bun.file('./x-y-z.vector.pbf').arrayBuffer())
// load the protobuf parsing it directly
const tile = new VectorTile(fixture)

console.log(tile)

// example layer
const { landuse } = tile.layers

// grab the first feature
console.log(landuse.feature(0))
console.log(landuse.feature(0).loadGeometry())
```

## General Purpose API

### Tile

#### Read in a Tile

```ts
const tile = new VectorTile(uint8Array)
```

#### Read in a layer

```ts
const layer = tile.layers[layerName]
```

### Layers

#### Layer Properties

```ts
type Extents = 512 | 1024 | 2048 | 4096 | 8192
interface Layer {
    // version control helps know what features are available
    version: number;
    // name of the layer
    name: string;
    // extent of the vector tile. MUST be one of `512`, `1024`, `2048`, `4096`, `8192`
    extent: Extents;
    // number of features in the layer
    length: number;
}
```

#### Read in a Feature

```ts
// returns a VectorFeature
const feature = layer.feature(index)
```

### Features

#### Feature Types

```ts
// 6 feature types in total plus the old MapboxVectorFeature
export type VectorFeature =
  // points may be a collection of points or single point
  | OVectorPointsFeature
  // lines may be a collection of lines or single line
  | OVectorLinesFeature
  // polygons may be a collection of polygons or single polygon
  | OVectorPolysFeature
  // 3D points may be a collection of 3D points or single 3D point
  | OVectorPoints3DFeature
  // 3D lines may be a collection of 3D lines or single 3D line
  | OVectorLines3DFeature
  // 3D polygons may be a collection of 3D polygons or single 3D polygon
  | OVectorPolys3DFeature
  // Can be any form of points, lines, or polygons without any of the new features
  // but all the functions. line offsets and bbox will always be defaults.
  | MapboxVectorFeature;
```

#### Feature Properties

```ts
type Extents = 512 | 1024 | 2048 | 4096 | 8192
interface Feature {
    // properties of the feature
    properties: any;
    // id of the feature
    id: number;
    // extent of the vector tile. MUST be one of `512`, `1024`, `2048`, `4096`, `8192`
    extent: Extents;
}
```

#### Get the Feature's Bounding Box

```ts
export type BBox = [left: number, bottom: number, right: number, top: number];
export type BBox3D = [left: number, bottom: number, right: number, top: number, near: number, far: number];

const bbox: BBox | BBox3D = feature.bbox()
```

#### Pull in the geometry as a collection of points

```ts
// supported by all types, points, lines, and polygons
const geometry: Point[] | Point3D[] = feature.loadPoints()
```

#### Pull in the geometry as a collection of lines

```ts
// Supported by any line or polygon type
/// points will return an empty array
interface VectorLineWithOffset {
  /** the offset of the line to start processing the dash position */
  offset: number;
  /** the line data */
  geometry: VectorLine;
}
interface VectorLine3DWithOffset {
  /** the offset of the line to start processing the dash position */
  offset: number;
  /** the line data */
  geometry: VectorLine3D;
}
const geometry: VectorLineWithOffset[] | VectorLine3DWithOffset[] = feature.loadLines()
```

### Pull in the geometry relative to the type

```ts
const pointFeature: Point[] = (feature as OVectorPointsFeature).loadGeometry()
const lineFeature: VectorLine[] = (feature as OVectorLinesFeature).loadGeometry()
const polyFeature: VectorPoly[] = (feature as OVectorPolysFeature).loadGeometry()
const point3DFeature: Point3D[] = (feature as OVectorPoints3DFeature).loadGeometry()
const line3DFeature: VectorLine3D[] = (feature as OVectorLines3DFeature).loadGeometry()
const poly3DFeature: VectorPoly3D[] = (feature as OVectorPolys3DFeature).loadGeometry()
```

### If a Polygon type, Pull in the raw geometry with indices and tesselation data

```ts
// works for any polygon or polygon3D type.
// NOTE: If the indices is empty, then the geometry was never pre-earcut and you need to fallback to `loadGeometry` instead.
const geometry: [geometry: number[], indices: number[]] = feature.loadGeometryFlat()
```

---

## Development

### Requirements

You need the tool `tarpaulin` to generate the coverage report. Install it using the following command:

```bash
cargo install cargo-tarpaulin
```

The `bacon coverage` tool is used to generate the coverage report. To utilize the [pycobertura](https://pypi.org/project/pycobertura/) package for a prettier coverage report, install it using the following command:

```bash
pip install pycobertura
```

### Running Tests

To run the tests, use the following command:

```bash
# TYPESCRIPT
## basic test
bun run test
## live testing
bun run test:dev

# RUST
## basic test
cargo test
# live testing
bacon test
```

### Generating Coverage Report

To generate the coverage report, use the following command:

```bash
cargo tarpaulin
# bacon
bacon coverage # or type `l` inside the tool
```
