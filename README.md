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
* Indexed geometries.
* Pre-Tessellated geometries to quickly send to the renderer.
* Support for 3D geometries.
* Support for M-Values for each geometry point (used by lines and polygons).
  * M-Values are stored as "Shapes" which reuses objects only needing to do lookups on values.
* Column encoding of data to make it more compact. Better gzip and brotli compression.
* Support nested objects in properties.

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

## Why Not`...`

* `SIMD encoding/decoding`:
This is a neat feature, but Rust does not have first class citizen support, especially when using `no_std`. It's important for this library to also support embedded devices, which wont have access to stdlib but also will not have access to SIMD. These are both a solved problem for Zig, but not for Rust. I want funding so this project will be done in Typescript & Rust.
* `cloud level filtering of features`:
Just no. It doesn't make sense. It's like fetching a WEBP tile for rendering and being like, "yeah but I only need half of it, right?". The cost of a Vector Tile after zoom 4 is almost always less then 100kB. Let that sync in, the whole point of vector **tiles** is to already be easily parsed chunks of data. Also, by allowing for partial requests, you are applying excess pressure on the server side that also wont benefit from the cache system.

### Example use

```js
const fs = from 'fs'
import { VectorTile } from 'open-vector-tile'

const fixture = fs.readFileSync('./fixtures/14-8801-5371.vector.pbf')

const tile = new VectorTile(fixture) // load the protobuf parsing it directly

console.log(tile)

let { landuse } = tile.layers // 107 features

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
