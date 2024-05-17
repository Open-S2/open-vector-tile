# open-vector-tile [![npm][npm-image]][npm-url] [![downloads][downloads-image]][downloads-url] [![bundlephobia][bundlephobia-image]][bundlephobia-url]

[npm-image]: https://img.shields.io/npm/v/open-vector-tile.svg
[npm-url]: https://npmjs.org/package/open-vector-tile
[bundlephobia-image]: https://img.shields.io/bundlephobia/minzip/open-vector-tile@0.1.0.svg
[bundlephobia-url]: https://bundlephobia.com/package/open-vector-tile@0.1.0
[downloads-image]: https://img.shields.io/npm/dm/open-vector-tile.svg
[downloads-url]: https://www.npmjs.com/package/open-vector-tile

## About

A Modified TypeScript implementation of the [Mapbox Vector Tile](https://github.com/mapbox/vector-tile-js) library. It is backwards compatible but offers a lot of new features and improvements including (but not limited to):

* Proper module treeshake.
* Pre-Tessellated & Indexed geometries to quickly ship data to the renderer.
* Support for 3D geometries.
* Support for M-Values for each geometry point (used by lines and polygons).
  * M-Values are stored as "Shapes" which reuses objects only needing to do lookups on values.
* Column encoding of data to make it more compact. Better gzip and brotli compression.
* Support nested objects in properties.

## Inspiration

A very talented [Markus Tremmel](https://github.com/mactrem) came up with the idea of migrating away from a row based approach to a column based approach with his [COVTiles](https://github.com/mactrem/cov-tiles). I wanted to test the idea of simplifying his approach and see if it was worth the effort. Once I saw I got better results post compression I decided to finish this project.

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
cargo install ovtile
```

### Example use

```js
const fs = from 'fs'
import { VectorTile } from 'open-vector-tile'

// assume you can read (.pbf | .mvt | .ovt)
const fixture = fs.readFileSync('./x-y-z.vector.pbf')
// load the protobuf parsing it directly
const tile = new VectorTile(fixture)

console.log(tile)

// example layer
const { landuse } = tile.layers

// grab the first feature
console.log(landuse.feature(0))
console.log(landuse.feature(0).loadGeometry())
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
# bacon
bacon test
```

### Generating Coverage Report

To generate the coverage report, use the following command:

```bash
cargo tarpaulin
# bacon
bacon coverage # or type `l` inside the tool
```
