<h1 style="text-align: center;">
<div align="center">open-vector-tile</div>
</h1>

<p align="center">
  <a href="https://img.shields.io/github/actions/workflow/status/Open-S2/open-vector-tile/test.yml?logo=github">
    <img src="https://img.shields.io/github/actions/workflow/status/Open-S2/open-vector-tile/test.yml?logo=github" alt="GitHub Actions Workflow Status">
  </a>
  <a href="https://npmjs.org/package/open-vector-tile">
    <img src="https://img.shields.io/npm/v/open-vector-tile.svg?logo=npm&logoColor=white" alt="npm">
  </a>
  <a href="https://crates.io/crates/open-vector-tile">
    <img src="https://img.shields.io/crates/v/open-vector-tile.svg?logo=rust&logoColor=white" alt="crate">
  </a>
  <a href="https://bundlejs.com/?q=open-vector-tile&treeshake=%5B%7B+VectorTile+%7D%5D">
    <img src="https://img.shields.io/bundlejs/size/open-vector-tile?exports=VectorTile" alt="bundle">
  </a>
  <a href="https://www.npmjs.com/package/open-vector-tile">
    <img src="https://img.shields.io/npm/dm/open-vector-tile.svg" alt="downloads">
  </a>
  <a href="https://open-s2.github.io/open-vector-tile/">
    <img src="https://img.shields.io/badge/docs-typescript-yellow.svg" alt="docs-ts">
  </a>
  <a href="https://docs.rs/open-vector-tile">
    <img src="https://img.shields.io/badge/docs-rust-yellow.svg" alt="docs-rust">
  </a>
  <a href="https://coveralls.io/github/Open-S2/open-vector-tile?branch=master">
    <img src="https://coveralls.io/repos/github/Open-S2/open-vector-tile/badge.svg?branch=master" alt="code-coverage">
  </a>
  <a href="https://discord.opens2.com">
    <img src="https://img.shields.io/discord/953563031701426206?logo=discord&logoColor=white" alt="Discord">
  </a>
</p>

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
* 🫥 Lines and Polygons support `offsets` to know the distance it's traveled (useful for correctly rendering dashed lines across tiles).

## Inspiration

A very talented [Markus Tremmel](https://github.com/mactrem) came up with the idea of migrating away from a row based approach to a column based approach with his [COVTiles](https://github.com/mactrem/cov-tiles). I wanted to test the idea of simplifying his project and see if it was worth the effort. Once I saw brotli compression had comperable results, I decided to finish the project.

## Motivations

Since another spec is being built at the same time, you may think this is a waste of time or creating an unnecessary conflict of interest. [So I wrote my thoughts on this topic and why this spec is being created](/motivation.md).

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

## Project Structure

<p align="center">
  <img src="https://raw.githubusercontent.com/Open-S2/open-vector-tile/master/assets/dependency-graph.svg" alt="Dependency Graph">
</p>

## Example use

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
type Extents = 512 | 1_024 | 2_048 | 4_096 | 8_192 | 16_384
interface Layer {
    // version control helps know what features are available
    version: number;
    // name of the layer
    name: string;
    // extent of the vector tile. MUST be one of `512`, `1024`, `2048`, `4096`, `8192`, or `16384`
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
type Extents = 512 | 1_024 | 2_048 | 4_096 | 8_192 | 16_384
interface Feature {
    // properties of the feature
    properties: any;
    // id of the feature
    id: number;
    // extent of the vector tile. MUST be one of `512`, `1_024`, `2_048`, `4_096`, `8_192`, or `16_384`
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

### Creating and Validating your Shapes

Shapes define the type of data that can be stored in the vector tile. They are explained in the [specification](https://github.com/Open-S2/open-vector-tile/tree/master/vector-tile-spec/1.0.0#44-shapes).

If you'd like to validate the shape, feel free to use the [Ajv](https://github.com/epoberezkin/ajv) library.

```ts
import Ajv from 'ajv';
import { ShapeSchema } from 'open-vector-tile'; // Path to the schema

import type { Shape } from 'open-vector-tile';

const ajv = new Ajv();
const validate = ajv.compile(ShapeSchema);

const shape: Shape = {
  a: 'i64',
  b: ['string'],
  c: {
    d: 'f64',
    e: 'bool',
    f: 'null',
    g: 'f32',
    h: {
      i: 'u64',
    },
  },
};

validate(shape); // true
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
# faster
cargo tarpaulin --color always --skip-clean
# bacon
bacon coverage # or type `l` inside the tool
```
