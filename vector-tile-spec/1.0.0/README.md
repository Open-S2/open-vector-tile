# Open Vector Tile Specification 1.0.0

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in
this document are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

## Table of contents

1. [Purpose](#1-purpose)
1. [File format](#2-file-format)
1. [Projection and Bounds](#3-projection-and-bounds)
1. [Internal Structure](#4-internal-structure)
    1. [Tile](#41-tile)
    1. [Column Cache](#42-column-cache)
    1. [Vector Layer](#43-vector-layer)
    1. [Shapes](#44-shapes)
    1. [Feature](#45-feature)
    1. [Grid Layer](#46-grid-layer)
    1. [Image Layer](#47-image-layer)
1. [Utility Functions](#5-utility-functions)
    1. [ZigZag](#51-zigzag)
    1. [Weave Functions](#52-weave-functions)
    1. [Weave Functions 3D](#53-weave-functions-3d)
    1. [Encode Offset](#54-encode-offset)
1. [Security Considerations](#6-security-considerations)

## 1. Purpose

This document specifies a space-efficient encoding format for tiled geographic vector data. It is designed to be used in browsers or server-side applications for fast rendering or lookups of feature data.

## 2. File Format

The Vector Tile format primarily uses [Google Protocol Buffers](https://developers.google.com/protocol-buffers/) as a encoding format. Protocol Buffers are a language-neutral, platform-neutral extensible mechanism for serializing structured data. Some

### 2.1. File Extension

The filename extension for Vector Tile files SHOULD be `ovt`. For example, a file might be named `vector.ovt`.

### 2.2. Multipurpose Internet Mail Extensions (MIME)

When serving Vector Tiles the MIME type SHOULD be `application/ovt`.

## 3. Projection and Bounds

A Vector Tile represents data based on a square extent representing a 0-1 coordinate space. A Vector Tile SHOULD NOT contain information about its bounds and projection. The file format assumes that the decoder knows the bounds and projection of a Vector Tile before decoding it.

[Web Mercator](https://en.wikipedia.org/wiki/Web_Mercator) is the projection of reference, and [the Google tile scheme](http://www.maptiler.org/google-maps-coordinates-tile-bounds-projection/) is the tile extent convention of reference. Together, they provide a 1-to-1 relationship between a specific geographical area, at a specific level of detail, and a path such as `https://example.com/17/65535/43602.ovt`. Another common projection to be used is the [S2 Geometry](https://github.com/google/s2-geometry) spherical projection.

Vector Tiles MAY be used to represent data with any projection and tile extent scheme.

## 4. Internal Structure

This specification describes the structure of data within a Vector Tile. The reader should have an understanding of the [Vector Tile protobuf schema document](vector_tile.proto) and the structures it defines.

### 4.1. Tile

A Vector Tile consists of one or more layers and a column-cache system if OVT is used.

The Vector Tile MUST contain two layer types: Mapbox Vector Tile "MVT" Layer and Open Vector Tile "OVT" Layer. This ensures backward compatibility with older commonly used vector specifications along with the new OVT format.

Vector Tiles that utilize the OVT format MUST contain a column cache to store all raw data in a columnar format.

Tile's utilize Protobuf encoding to store layer and column-cache data at the top level. MVT Layers are stored with "message id" `3` and OVT Layers are stored with "message id" `4`. All column-cache data is stored with "message id" `5`.

#### 4.1.1. Mapbox Vector Tile (MVT) Layer & Open Flat Vector Tile (OFVT) Layer

The tile, layer, and feature encodings follow the specification for the [Mapbox Vector Tile Specification](https://github.com/mapbox/vector-tile-spec). This format is widely adopted and ensures that existing tools and libraries can work seamlessly with the tiles.

The `Open Flat Vector Tile` (OFVT) is a modified version of the MVT format that is optimized for better performance. It fixes 3 issues with the MVT format:

1. The `extent` field is now required as it was always intented to be.
2. Polygons now support a `closePolygon` flag for better compression and decompression without having to rebuild them.
3. Polygons support indices and tessellation values to remove the need to earclip them before rendering.

### 4.1.2. Open Vector Tile (OVT) Layer

This is the new format for the Open Vector Tile spec. Similar to MVT, the tile consists of layers, but also contains a column cache to optimize data storage and access.

#### 4.1.2.1. Vector Data

The most common data stored in Vector Tiles are vector features. A feature is a collection of geometry and properties. The geometry is stored in the `geometry` field and the properties are stored in the `properties` field. You can learn more about the `Vector Layer` structure in section `4.3.`.

#### 4.1.2.2. Elevation Data

The elevation data is a collection of points in a grid format much like an image with an elevation variable attached to each point. You can learn more about the `Elevation Layer` structure in section `4.6.`.

#### 4.1.2.3. Image Data

The image data is stored in the `image` field. This is a round-about way to group an image like WebP together with vector data. You can learn more about the `Image Layer` structure in section `4.7.`.

### 4.2. Column Cache

The column cache exists to store all raw data in a columnar format. This helps reduce file size by avoiding duplication and compressing similar data in the same section of the file. The column cache stores data such as feature properties and attribute values, which are referenced by the features in the layers.

**Benefits**:

- **Reduced File Size**: By storing similar data together, the column cache can significantly reduce the overall size of the tile.
- **Efficient Data Access**: Data can be accessed more quickly since related information is stored together.
- **Avoids Duplication**: Common values are stored once in the cache, rather than being repeated for each layer or feature.

### 4.2.0. Column Cache Definitions

**OColumnName**:

An `enum` describing the column cache's column positions.

```pscript
enum OColumnName {
  string = 0
  uint64 = 1
  int64 = 2
  float = 3
  double = 4
  points = 5
  points3D = 6
  indices = 7
  shapes = 8
  bbox = 9
}
```

### 4.2.1. Column Cache Structure

Column cache MUST contain 10 types of data for storage: string, uint64, int64, float (32-bit), double (64-bit), points, points3D, indices, shapes, and bbox.

### 4.2.2. Column Cache - String

The string column cache stores all unique string values that are used in the tile's features. This is used by Layer's "name" property along with any property/mValue "key" or "value" that uses a string.

When storing the array of strings in the column cache, the protobuf "field id" MUST be `0`.

### 4.2.3. Column Cache - Unsigned

The uint64 column cache stores all unique unsigned values used in the tile's features. This also includes a feature's id or properties/mValue value that uses an unsigned integer.

When storing the array of uint64 in the column cache, the protobuf "field id" MUST be `1`. The number array MUST be sorted in ascending order prior to storage.

### 4.2.4. Column Cache - Signed

The int64 column cache stores all unique signed values used in the tile's features. This can be used by properties/mValue value that uses a signed integer.

When storing the array of int64 in the column cache, the protobuf "field id" MUST be `2`. The number array MUST be sorted in ascending order prior to storage.

### 4.2.5. Column Cache - Float

The float column cache stores all unique 32-bit float values used in the tile's features. This can be used by properties/mValue value that uses a float.

When storing the array of float in the column cache, the protobuf "field id" MUST be `3`. The number array MUST be sorted in ascending order prior to storage.

### 4.2.6. Column Cache - Double

The double column cache stores all unique 64-bit double values used in the tile's features. This can be used by properties/mValue value that uses a double.

When storing the array of double in the column cache, the protobuf "field id" MUST be `4`. The number array MUST be sorted in ascending order prior to storage.

### 4.2.7. Column Cache - Points

The points column cache stores all unique 2D point coordinates (x, y) used in the tile's features. Points are typically used to represent geometric shapes such as a collections of same properties points, vertices of lines, and polygonal shapes.

While `points` is a collection of 2D point coordinates, depending upon the feature type, may have unique methods of encoding and decoding. (See section 4.5.5. for details.)

When storing the array of points in the column cache, the protobuf "field id" MUST be `5`. The number array MUST be sorted in ascending order prior to storage.

**Encoding**:

Before storing points in the column cache, they MUST be encoded using the `weaveAndDeltaEncodeArray` method. This method optimizes the storage by interweaving and zig-zag-delta encoding the coordinates.

**ZigZag the Deltas**: Delta encoding stores the difference between consecutive values rather than the absolute values. This often results in smaller numbers, which can be stored more efficiently. The resultant numbers are then zigzagged to ensure they are unsigned values.

Refer to Section `5.` for the `zigzag` and `weave2D` functions.

**Weave (X, Y)**: This process interweaves the x and y coordinates of the points into a single 32-bit number. Each coordinate is treated as a 16-bit unsigned number. The function `weave2D` combines these two 16-bit numbers into a single 32-bit number.

![weave](https://github.com/Open-S2/open-vector-tile/blob/master/assets/weave-technique.png?raw=true)

```pscript
function weaveAndDeltaEncodeArray(array):
    res = []
    prevX = 0
    prevY = 0

    for I from 0 to length of array - 1:
        x = array[I].x
        y = array[I].y
        posX = zigzag(x - prevX)
        posY = zigzag(y - prevY)
        res.append(weave2D(posX, posY))
        prevX = x
        prevY = y

    return res
```

Example:

```md
0000 0011 (3)
0000 0101 (5)
-------------
0000 0000 0010 0111 (39)
```

**Result**:

```ts
const input = [
  { x: 55, y: 22 },
  { x: 11, y: 33 },
  { x: 22, y: 44 },
  { x: 23, y: 42 },
]
const output = weaveAndDeltaEncodeArray(input)
console.log(output) // [7412, 4925, 828, 14]
```

### 4.2.8. Column Cache - Points3D

The points column cache stores all unique 3D point coordinates (x, y, z) used in the tile's features. Points are typically used to represent geometric shapes such as a collections of same properties points3D, vertices of lines3D, and 3D polygonal shapes.

While `points` is a collection of 3D point coordinates, depending upon the feature type, may have unique methods of encoding and decoding. (See section 4.5.5. for details.)

When storing the array of points in the column cache, the protobuf "field id" MUST be `6`. The number array MUST be sorted in ascending order prior to storage.

**Encoding**:

Before storing points in the column cache, they MUST be encoded using the `weaveAndDeltaEncode3DArray` method. This method optimizes the storage by interweaving and zig-zag-delta encoding the coordinates.

**ZigZag the Deltas**: Delta encoding stores the difference between consecutive values rather than the absolute values. This often results in smaller numbers, which can be stored more efficiently. The resultant numbers are then zigzagged to ensure they are unsigned values.

Refer to Section `5.` for the `zigzag` and `weave3D` functions.

**Weave (X, Y, Z)**: This process interweaves the x, y, and z coordinates of the points into a single 48-bit number. Each coordinate is treated as a 16-bit unsigned number. The function `weave3D` combines these three 16-bit numbers into a single 48-bit number.

```pscript
function weaveAndDeltaEncode3DArray(array):
    res = []
    offsetX = 0
    offsetY = 0
    offsetZ = 0

    for I from 0 to length of array - 1:
        x = array[I].x
        y = array[I].y
        z = array[I].z
        posX = zigzag(x - offsetX)
        posY = zigzag(y - offsetY)
        posZ = zigzag(z - offsetZ)
        res.append(weave3D(posX, posY, posZ))
        offsetX = x
        offsetY = y
        offsetZ = z

    return res
```

Example:

```md
0000 0011 (3)
0000 0101 (5)
0000 0110 (6)
-------------
0000 0000 0000 0001 1010 1011 (427)
```

**Result**:

```ts
const input = [
  { x: 55, y: 22, z: 1 },
  { x: 11, y: 33, z: 2 },
  { x: 22, y: 44, z: 3 },
  { x: 23, y: 42, z: 4 },
]
const output = weaveAndDeltaEncode3DArray(input)
console.log(output) // [362216, 274681, 12536, 58]
```

### 4.2.9. Column Cache - Indices

The indices column cache stores all unique indices used in the tile's features. Indices are used to reference features in the feature array. Indices are used by geometry encodings or polygons/polgyons3D indices data if the feature's earcut was used. (See section 4.5.5. for details.)

When storing each indices array in the column cache, the protobuf "field id" MUST be `7`.

**Encoding**:

Before storing points in the column cache, they MUST be encoded using the `deltaEncodeArray` method. This method optimizes the storage by zig-zag-delta encoding each index from the previous.

Refer to Section `5.` for the `zigzag` function.

```pscript
function deltaEncodeArray(array):
    res = []
    offset = 0

    for I from 0 to length of array - 1:
        num = array[I]
        res.append(zigzag(num - offset))
        offset = num

    return res
```

### 4.2.10. Column Cache - Shapes

A Shape defines how to encode/decode a JSON object, including nested objects, arrays, and primitives. You can learn more including encoding in section 4.4.

When storing each shape in the column cache, the protobuf "field id" MUST be `8`.

### 4.2.11. Column Cache - BBOX

A bounding box may be either 2D or 3D. Consult section 4.5.4. for details.

When storing each bbox in the column cache, the protobuf "field id" MUST be `9`.

**Encoding**:

BBOX encoding uses quantization to reduce the number of bits used. This means that encoding bbox is a lossy-compression process. However, the values are still highly accurate with the longitude maintaing ~2.388 meters of precision and the latitude maintaining ~1.194 meters precision.

A 2D Bounding box is encoded using the `quantizeBBox` method. A 3D Bounding box is encoded using the `dequantizeBBox3D` method. The following pseudo-code illustrates the encoding process:

```pscript
// 24-bit precision encoding of longitude
function quantizeLon(lon):
    return round(((lon + 180) * 16777215) / 360)

// 24-bit precision encoding of latitude
function quantizeLat(lat):
    return round(((lat + 90) * 16777215) / 180)

function pack24BitUInt(buffer, value, offset):
    buffer[offset] = (value shifted right by 16) AND 0xff
    buffer[offset + 1] = (value shifted right by 8) AND 0xff
    buffer[offset + 2] = value AND 0xff

function packFloat(buffer, value, offset):
    view = DataView(buffer)
    view.setFloat32(offset, value, true)  // true for little-endian

function quantizeBBox(bbox):
    is3D = (length of bbox is 6)
    buffer = new Uint8Array(is3D ? 20 : 12)

    qLon1 = quantizeLon(bbox[0])
    qLat1 = quantizeLat(bbox[1])
    qLon2 = quantizeLon(bbox[2])
    qLat2 = quantizeLat(bbox[3])

    pack24BitUInt(buffer, qLon1, 0)
    pack24BitUInt(buffer, qLat1, 3)
    pack24BitUInt(buffer, qLon2, 6)
    pack24BitUInt(buffer, qLat2, 9)
    if is3D:
        packFloat(buffer, bbox[4], 12)
        packFloat(buffer, bbox[5], 16)

    return buffer
```

### 4.3. Vector Layer

In the context of vector tiles, a layer is a collection of vector features of a particular type, such as points, lines, or polygons. Each vector tile can contain multiple layers, each with its own set of features and associated attributes. This section outlines the structure and properties of layers within the vector tile specification.

#### 4.3.1. Layer Structure

A layer consists of several key components:

- **version**: An unsigned-integer that defines the version of the layer.
- **name**: A string that uniquely identifies the layer within the tile.
- **features**: An array of vector features contained within the layer.
- **extent**: An `enum` that defines the grid size used to specify feature geometry.
- **shape**: A Shape that defines the shape of the feature's `property` value.
- **mShape**: A Shape that defines the shape of the M-Values inside the feature.

A Layer MUST contain a `version` field.

A Layer MUST contain a `name` field.

A Layer MUST contain an `extent` field.

A Layer SHOULD contain a `feature` field.

A Layer MAY contain a `shape` field, but MUST contain a `shape` field if a `feature` is present.

A Layer MAY contain a `mShape` field, but MUST contain a `mShape` field if a `feature` with an M-Value is present.

##### 4.3.1. Layer Version

A layer MUST contain a `version` field with the major version number of the Vector Tile specification to which the layer adheres. For example, a layer adhering to version 2.1 of the specification contains a `version` field with the integer value `2`. The `version` field SHOULD be the first field within the layer. Decoders SHOULD parse the `version` first to ensure that they are capable of decoding each layer. When a Vector Tile consumer encounters a Vector Tile layer with an unknown version, it MAY make a best-effort attempt to interpret the layer, or it MAY skip the layer. In either case it SHOULD continue to process subsequent layers in the Vector Tile.

When storing the `version` in the layer, the protobuf "field id" MUST be `1`.

##### 4.3.2. Layer Name

A layer MUST contain a `name` field. A Vector Tile MUST NOT contain two or more layers whose `name` values are byte-for-byte identical. Prior to appending a layer to an existing Vector Tile, an encoder MUST check the existing `name` fields in order to prevent duplication.

When storing the `name` in the layer, the protobuf "field id" MUST be `2`. The `name` string value MUST be stored in the `column cache` and it's index is stored as the protobuf field value.

##### 4.3.3. Layer Features

Features are described in greater detail in section `4.5.`. The features atrribute contains a list of `Feature` objects.

A layer SHOULD contain at least one feature.

##### 4.3.4. Layer Extent

A layer MUST contain an `extent` that describes the width and height of the tile in integer coordinates. The geometries within the Vector Tile MAY extend past the bounds of the tile's area as defined by the `extent`. Geometries that extend past the tile's area as defined by `extent` are often used as a buffer for rendering features that overlap multiple adjacent tiles.

For example, if a tile has an `extent` of 4096, coordinate units within the tile refer to 1/4096th of its square dimensions. A coordinate of 0 is on the top or left edge of the tile, and a coordinate of 4096 is on the bottom or right edge. Coordinates from 1 through 4095 inclusive are fully within the extent of the tile, and coordinates less than 0 or greater than 4096 are fully outside the extent of the tile.  A point at `(1,10)` or `(4095,10)` is within the extent of the tile. A point at `(0,10)` or `(4096,10)` is on the edge of the extent. A point at `(-1,10)` or `(4097,10)` is outside the extent of the tile.

An `extent` value MUST be one of the following: `16_384`, `8_192`, `4_096`, `2_048`, `1_024`, or `512`.

When storing the `extent` in the layer, the protobuf "field id" MUST be `3`.

**Encoding**:

To reduce the size of the layer's `extent` value, since each `extent` is protobuf varint encoded, we use the following encoding:

```pscript
Extents = { 16384, 8192, 4096, 2048, 1024, 512 }

function encodeExtent(extent):
    if extent is 16384: return 5
    else if extent is 8192: return 4
    else if extent is 4096: return 3
    else if extent is 2048: return 2
    else if extent is 1024: return 1
    else if extent is 512: return 0
    else: Error('invalid extent, must be 512, 1024, 2048, 4096, 8192, or 16384')
```

#### 4.3.5. Layer Shape

Shapes are described in greater detail in section `4.4.`. Shapes exist to define how to decode a JSON object, including nested objects, arrays, and primitives for each feature inside the layer.

A Layer MAY contain a `shape` field, but MUST contain a `shape` field if a `feature` is present.

#### 4.3.6. Layer M-Shape

Shapes are described in greater detail in section `4.4.`. M-Shapes exist to define how to decode a JSON object, including nested objects, arrays, and primitives for each feature's M-Value inside the layer.

M-Values are bound to individual feature geometry point. You can learn more about M-Values in section `4.5.2.`.

A Layer MAY contain a `mShape` field, but MUST contain a `mShape` field if a `feature` with an M-Value is present.

### 4.4. Shapes

Shapes are designed to compliment the [s2json specification's properties](https://github.com/Open-S2/s2json/tree/master/s2json-spec/1.0.0#6-properties), which you can find it's clearly defined schema [here](https://github.com/Open-S2/s2json/blob/ec62909e3ae76807babd7428afec4ad79260a9cd/src/s2json.schema.json#L63). Shapes are almost as powerful as full blown objects, but have certain boundaries to ensure they are easy to encode/decode.

You can see the schematic of a shape in the [src folder](https://github.com/Open-S2/open-vector-tile/blob/master/src/open/shape.schema.json).

A Shape defines how to encode/decode a JSON object, including nested objects, arrays, and primitives.

#### 4.4.1. Shape Structure

Shapes are used to deconstruct and rebuild objects with the following limitations:

- All keys MUST be strings.
- All values MAY BE either:
  - Primitive types: `string`, numbers (`f32`, `f64`, `u64`, `i64`), `true`, `false`, or `null`
  - Subtypes: an array of a shape or a nested object which is itself a shape
  - If the subtype is an array, all elements MUST BE of the same type
  - Primitive types MUST NOT be `undefined`.

A pseudo explination looks as follows:

```pscript
// Define the possible primitive types in a shape
PrimitiveShapes:
  - string
  - f32
  - f64
  - u64
  - i64
  - bool
  - null

// Define the types that can be found in a shape
ShapeType:
  - PrimitiveShapes         // a primitive type
  - Array<ShapeType>        // an array containing any type
  - Shape                   // a nested shape

// Define the Shape object structure
Shape:
  - key (string): ShapeType
```

#### 4.4.2. Shape Encoding

Before storing shapes in the column cache, they MUST be encoded using the `encodeShape` method. It's best to explain using pseudo-code. `cache.addColumnData` stores data according to section `4.2`.

```pscript
// Encode a shape type
function shapePrimitiveToColumnName(type):
    if type is 'string': 0
    else if type is 'u64': 1
    else if type is 'i64': 2
    else if type is 'f32': 3
    else if type is 'f64': 4
    else if type is 'bool': return 5
    else: return 6

function encodeAttribute(type, countOrColname):
    return (countOrColname shifted left by 2) + type

function encodeShape(cache, shape):
    shapeStore = []
    _encodeShape(shape, shapeStore, cache)
    return cache.addColumnData(OColumnName.shapes, shapeStore)

function _encodeShape(shape, shapeStore, cache):
    if shape is an array:
        shapeStore.append(0)
        _encodeShape(shape[0], shapeStore, cache)
    else if shape is an object:
        entries = shape entries
        shapeStore.append(encodeAttribute(1, length of entries))
        for each (key, value) in entries:
            shapeStore.append(cache.addColumnData(OColumnName.string, key))
            _encodeShape(value, shapeStore, cache)
    else:
        shapeStore.append(encodeAttribute(2, shapePrimitiveToColumnName(shape)))
```

#### 4.4.3. Shape Example

Typescript example of a shape and properties/mValues that adhere to the shape:

```ts
// Shape construction
const exampleShape: Shape = {
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
// examples of properties/mValue data that adheres to the shape:
const exampleValue: OProperties = {
  a: 3,
  b: ['hello', 'world'],
  c: {
    d: 2.2,
    e: true,
    f: null,
    g: 4.5,
    h: {
      i: 2,
    },
  },
};
const exampleValue2: OProperties = {
  a: -1,
  b: ['word', 'up', 'hello'],
};
```

### 4.5. Feature

In the context of vector tile layers, a feature contains

#### 4.5.1. Feature Structure

A layer consists of several key components:

- **id**: An unsigned-integer that acts as an identifier for the feature
- **type**: The geometry type of the feature
- **properties**: A set of properties that can be used to identify the feature
- **bbox**: The bounding box of the feature
- **flags**: A set of flags to describe how to decode components of the feature
- **geometry**: The geometry of the feature
- **mValues**: A set of M-Values that coexists with the geometry
- **indices**: A set of indices that coexists with the geometry
- **tessellation**: A set of vertices that compliment the geometry for polygons and polygons3D

A Layer MAY contain a `id` field.

A Layer MUST contain a `type` field.

A Layer MUST contain a `properties` field.

A Layer MAY contain a `bbox` field.

A Layer MUST contain a `flags` field.

A Layer MUST contain a `geometry` field.

A Layer MAY contain a `m-values` field.

A Layer MAY contain an `indices` field.

A Layer MAY contain a `tessellation` field.

**Encoding**:

A feature is encoded as a protobuf's varint encoding using the following structure & order:

- **feature's type**
- **feature's flags**
- **feature's id** (optional)
- **feature's value index** (stored in the column cache)
- **feature's geometry** (stored in the column cache)
- **feature's indices** (optional and stored in the column cache)
- **features's tessellation** (optional and stored in the column cache)
- **feature's bbox** (optional and stored in the column cache)

An example of an encoded feature is as follows:

```spec
Feature: [3 255 122 17 10 14 3 9 ]
          |   |   |  |  |  | | `> The bbox index in the column cache
          |   |   |  |  |  | `> The tessellation index in the column cache
          |   |   |  |  |  `> The indices index in the column cache
          |   |   |  |  `> The geometry index in the column cache
          |   |   |  `> The properties value index in the column cache to decode
          |   |   `> The features ID
          |   `> The feature's flags encoded as a uint8
          `> The feature's type
```

#### 4.5.2. Feature ID

A feature MAY contain an `id` field. If a feature has an `id` field, the value of the `id` SHOULD be unique among the features of the parent layer. A feature ID MUST be a non-negative integer.

#### 4.5.3. Feature Type

A feature MUST contain a `type` field.

The `geometry` field is described in each feature by the `type` field which must be a value in the enum `VectorFeatureType`. The following `enum` descibes the possible `type` values:

```spec
enum VectorFeatureType {
    Points = 1;
    Lines = 2;
    Polygons = 3;
    Points3D = 4;
    Lines3D = 5;
    Polygons3D = 6;
}
```

#### 4.5.4. Feature Properties

Properties follow the rules defined by [s2json specification's properties](https://github.com/Open-S2/s2json/tree/master/s2json-spec/1.0.0#6-properties), which you can find it's clearly defined schema [here](https://github.com/Open-S2/s2json/blob/ec62909e3ae76807babd7428afec4ad79260a9cd/src/s2json.schema.json#L63). Properties are almost as powerful as full blown objects, but have certain boundaries to ensure they are easy to encode/decode.

A feature MUST contain a `properties` field.

**Encoding**:

Each Property object is stored as a `Value`. A `Value` is encoding using a pairing `Shape` described in section `4.4.`. The `Shape` is added to the column cache in the `shapes` column.

It's best to explain the encoding using pseudo-code. `OColumnName` and the `cache.addColumnData` function are according to section `4.2`.

```pscript
function encodeValue(value, shape, cache):
    valueStore = []
    _encodeValue(value, shape, valueStore, cache)
    return cache.addColumnData(OColumnName.shapes, valueStore)

function _encodeValue(value, shape, valueStore, cache):
    if shape is an array:
        value = value as ValueArray
        valueStore.append(length of value)
        for each v in value:
            _encodeValue(v, shape[0], valueStore, cache)
    else if shape is an object:
        keys = keys of shape
        value = value as OProperties
        for each key in keys:
            _encodeValue(value[key], shape[key], valueStore, cache)
    else:
        if shape is 'string':
            valueStore.append(cache.addColumnData(OColumnName.string, value or ''))
        else if shape is 'u64':
            valueStore.append(cache.addColumnData(OColumnName.unsigned, value or 0))
        else if shape is 'i64':
            valueStore.append(cache.addColumnData(OColumnName.signed, value or 0))
        else if shape is 'f32':
            valueStore.append(cache.addColumnData(OColumnName.float, value or 0))
        else if shape is 'f64':
            valueStore.append(cache.addColumnData(OColumnName.double, value or 0))
        else if shape is 'bool':
            valueStore.append(cache.addColumnData(OColumnName.unsigned, value is true ? 1 : 0))
```

#### 4.5.5. BBOX

Bounds MUST be either 2D or 3D.

A bounding box defines the bounds of the feature in [World Geodetic System 1984 (WGS84)](https://gisgeography.com/wgs84-world-geodetic-system/) coordinates.

The BBOX is an OPTIONAL field.

A 2D bounding box MUST be an array of 4 numbers: `[min-lon, min-lat, max-lon, max-lat]`.

A 3D bounding box MUST be an array of 6 numbers: `[min-lon, min-lat, max-lon, max-lat, min-z, max-z]`.

#### 4.5.6. Flags

A feature MUST contain a `flags` field.

The flags field describes how to decode components of the feature. The flag is stored as a uint8 variable to define the following properties:

- **has-id**: A flag to indicate if the feature has an ID property
- **has-bbox**: A flag to indicate if the feature has a BBox
- **has-offsets**: A flag to indicate if the feature has offsets associated with each line in the geometry (relavent for lines[3D] and polygons[3D])
- **has-indices**: A flag to indicate if the feature has indices. This is relavent for polygons[3D].
- **has-tessellation**: A flag to indicate if the feature has tessellation. This is relavent for polygons[3D].
- **has-mValues**: A flag to indicate if the feature has M-Values
- **is-single**: A flag to indicate if the feature is single valued or multi valued.

#### 4.5.7. Geometry

A feature MUST contain a `geometry` field. Each feature type has a corresponding geometry structure associated with it. Encoding the geometry is defined under this section for each feature type as each case is unqiue.

##### 4.5.7.0. Geometry Utility Structures

**Point Structure**:

- **x**: The x coordinate of the point mapped to the layer's extent. [REQUIRED]
- **y**: The y coordinate of the point mapped to the layer's extent. [REQUIRED]
- **z**: The z coordinate of the point mapped to the layer's extent. [REQUIRED if 3D]
- **m**: The mValue associated with this point. [OPTIONAL (REQUIRED if the feature has MValues)]

The `x` and `y` coordinates are REQUIRED if the geometry is 2D, and the `x`, `y`, and `z` coordinates are REQUIRED if the geometry is 3D.

The `m` value is OPTIONAL. The `m` value is REQUIRED if the feature states that it has MValues.

**Line Structure**:

- **geometry**: An array of points that make up the line. [REQUIRED]
- **offset**: An array of M-Values that coexists with the points. [REQUIRED]

The geometry is always a sequence of points.

The offset is a number to represent the offset of the line. This offset is relative to the start of the line, since a sliced tile will have no knowledge of where the line began, we store the offset to help properly draw the line or perform computations that rely on the length of the line. If an offset was not provided, the default value is `0`.

##### 4.5.7.1. Points AND Points 3D

The `Points` and `Points3D` `VectorFeatureType`s encodes a point(3D) or MultiPoint(3D) geometry.

2D Point Feature's MUST set their `type` to `1`.

3D Point Feature's MUST set their `type` to `4`.

If the geometry includes only a single point, the `single` flag MUST be set.

If the geometry includes M-Values, the `mvalues` flag MUST be set.

NOTE: If the geometry is a single point(3D), the `mValue` flag will SHOULD NOT be set and will not be encoded.

**Encoding**:

A singular point has a unique encoding that returns it's coordinate shape as a single value to the feature encoding.

A multipoint stores all it's geometric data into an indices array which eventually is stored in the column cache's `indices` column.

It's best to explain the encoding using pseudo-code. `OColumnName` and the `cache.addColumnData` function are according to section `4.2`. `encodeValue` is defined acording to section `4.5.8.`.

Refer to Section `5.` for the `zigzag`, `weave2D` and `weave3D` functions.

```pscript
function addGeometryToCache(cache, mShape = {}):
    is3D = (this.type is 4)
    columnName = (is3D) ? OColumnName.points3D : OColumnName.points

    if length of geometry is 1:
        if is3D:
            x, y, z = geometry[0]
            return weave3D(zigzag(x), zigzag(y), zigzag(z))
        else:
            x, y = geometry[0]
            return weave2D(zigzag(x), zigzag(y))

    // Otherwise store the collection of points
    indices = []
    indices.append(cache.addColumnData(columnName, geometry))

    // Store the mvalues indexes if they exist
    if hasMValues:
        for each point in geometry:
            m = point.m
            indices.append(encodeValue(m or {}, mShape, cache))

    return cache.addColumnData(OColumnName.indices, indices)
```

##### 4.5.7.2. Lines & Lines 3D

The `Lines` and `Lines3D` `VectorFeatureType`s encodes a LineString(3D) or MultiLineString(3D) geometry.

2D LineStrings Feature's MUST set their `type` to `2`.

3D LineStrings Feature's MUST set their `type` to `5`.

If the geometry includes only a single line, the `single` flag MUST be set.

If the geometry includes offsets for each line (at least one line with a non-zero offset), the `offsets` flag MUST be set.

If the geometry includes M-Values, the `mvalues` flag MUST be set.

**Encoding**:

All geometry data is stored in an indices array which eventually is stored in the column cache's `indices` column.

It's best to explain the encoding using pseudo-code. `OColumnName` and the `cache.addColumnData` function are according to section `4.2`. `encodeValue` is defined acording to section `4.5.8.`.

Refer to Section `5.` for the `encodeOffset` function.

```pscript
function addGeometryToCache(cache, mShape = {}):
    geometry = this.geometry as array of BaseVectorLine(VectorLine or VectorLine3D)
    columnName = (this.type is 5) ? OColumnName.points3D : OColumnName.points
    indices = []

    // Store number of lines if more than one
    if length of geometry is not 1:
        indices.append(length of geometry)

    for each line in geometry:
        // Store offset for current line if it exists
        if hasOffsets:
            indices.append(encodeOffset(line.offset))

        // Store geometry data and track its index position
        indices.append(cache.addColumnData(columnName, line.geometry))

        // Store the mvalues indexes if they exist
        if hasMValues:
            for each point in line.geometry:
                m = point.m
                indices.append(encodeValue(m or {}, mShape, cache))

    return cache.addColumnData(OColumnName.indices, indices)
```

##### 4.5.7.3. Polygons & Polygons 3D

The `Polygons` and `Polygons3D` `VectorFeatureType`s encodes a Polygon(3D) or MultiPolygon(3D) geometry.

2D Polygons Feature's MUST set their `type` to `3`.

3D Polygons Feature's MUST set their `type` to `6`.

If the geometry includes only a single polygon, the `single` flag MUST be set.

If the geometry includes offsets for each line (at least one line with a non-zero offset), the `offsets` flag MUST be set.

If the geometry includes M-Values, the `mvalues` flag MUST be set.

If the geometry was earcut, and indices were created, the `indices` flag MUST be set.

If the geometry was earcut, and tessellation data were created, the `tessellation` flag MUST be set.

**Encoding**:

All geometry data is stored in an indices array which eventually is stored in the column cache's `indices` column.

It's best to explain the encoding using pseudo-code. `OColumnName` and the `cache.addColumnData` function are according to section `4.2`. `encodeValue` is defined acording to section `4.5.8.`.

Refer to Section `5.` for the `encodeOffset` function.

```pscript
function addGeometryToCache(cache, mShape = {}):
    geometry = this.geometry as array of array of BaseVectorLine(G)
    columnName = (this.type is 6) ? OColumnName.points3D : OColumnName.points
    indices = []

    // Store number of polygons if more than one
    if length of geometry is greater than 1:
        indices.append(length of geometry)

    for each poly in geometry:
        // Store number of lines in the polygon
        indices.append(length of poly)

        for each line in poly:
            // Store offset for current line if it exists
            if hasOffsets:
                indices.append(encodeOffset(line.offset))

            // Store geometry data and track its index position
            indices.append(cache.addColumnData(columnName, line.geometry))

            // Store the mvalues indexes if they exist
            if hasMValues:
                for each point in line.geometry as VectorLine or VectorLine3D:
                    m = point.m
                    indices.append(encodeValue(m or {}, mShape, cache))

    return cache.addColumnData(OColumnName.indices, indices)
```

##### 4.5.8. M-Values

M-Values follow the rules defined by [s2json specification's properties](https://github.com/Open-S2/s2json/tree/master/s2json-spec/1.0.0#6-properties) and [s2json specification's m-values](https://github.com/Open-S2/s2json/tree/master/s2json-spec/1.0.0#7-mvalues), which you can find it's clearly defined schema [here](https://github.com/Open-S2/s2json/blob/ec62909e3ae76807babd7428afec4ad79260a9cd/src/s2json.schema.json#L63) and [here](https://github.com/Open-S2/s2json/blob/ec62909e3ae76807babd7428afec4ad79260a9cd/src/s2json.schema.json#L67) respectively. M-Values are almost as powerful as full blown objects, but have certain boundaries to ensure they are easy to encode/decode.

A feature MAY contain a `m-values` field. The M-Values size and length MUST always match the geometries length and size. For example, if the Geometry type is a `LineString` the M-Values is also a `LineString` in shape, and it's length matches the coordinates length.

**Encoding**:

Each geometry type has it's own encoding. Please refer to each case to find how M-Values are woven into the geometry. It is entirely possible for a feature to be decoded with the mvalues woven in.

Each `Value` however is stored using the same mechanics as `properties` as descibed in section `4.5.4.`.

##### 4.5.9. Indices

Indices are OPTIONAL.

If the feature is a `Polygon` or `Polygon3D`, the indices MUST be stored in the column cache's `indices` column. No additional encoding is required.

##### 4.5.10. Tessellation Data

Tessellation Data is OPTIONAL.

If the feature is a `Polygon` or `Polygon3D`, the tessellation data MUST be stored in the column cache's `points` or `points3D` columns respectively. No additional encoding is required.

### 4.6. Grid Layer

This is a new and unique solution to the problem of storing gridded information. While old methods have stored elevation in RGBA images, note that the method is both lossy and often times memory expensive. The new method takes advantage of the delta encoding we have.

Examples of common grid data are `elevation`, `temperature`, `precipitation`, etc.
It also has interesting multi-band support with the naming convention. So you could store gridded V and U wind components in separate grid layers, and then combine them in the client.

An grid layer consists of several key components:

- **name**: The name of the layer.
- **extent**: An `enum` that defines the grid size used to specify feature geometry.
- **size**: A size defines the square length and width of the grid in "pixels".
- **min**: The minimum grid value.
- **max**: The maximum grid value.
- **data**: The actual grid data.

A Layer MUST contain a `name` field.

A Layer MUST contain an `extent` field.

A Layer MUST contain a `size` field.

A Layer MUST contain a `min` field.

A Layer MUST contain a `max` field.

A Layer MUST contain a `data` field.

#### 4.6.1. Extent

The extent of the layer is described in section 4.3.4.

#### 4.6.2. Size

The size of the layer represents the square length and width of the grid in pixels.

#### 4.6.3. Min * Max

The `min` is the lowest grid value in the grid and the `max` is the highest grid value in the grid.

#### 4.6.4. Data

To store the grid we first map the grid data to a range of 0 to `extent`:

```pscript
function mapElevation(array, extent, min, max):
    result = []
    for each value in array:
        result.append(round(((value - min) * extent) / (max - min)))
    return result
```

This ensures the data is in an unsigned 32-bit range. At this point we varint pack the data and run a `deltaEncodeArray` to further compress.

### 4.7. Image Layer

This is a convenience layer to include image data with vector or grid data. This helps reduce server requests and reduce file size. This layer supports storing via a naming convention, so if needed you can store multiple image layers in the same tile.

An image layer consists of several key components:

- **name**: The name of the layer.
- **type**: The type of image data. E.G. `image/png` or `image/jpeg`.
- **width**: The width of the image.
- **height**: The height of the image.
- **data**: The actual image data.

A Layer MUST contain a `name` field.

A Layer MUST contain an `type` field.

A Layer MUST contain a `width` field.

A Layer MUST contain a `height` field.

A Layer MUST contain a `data` field.

#### 4.7.1. Type

An `enum` describing the type of image. Limited to `png`, `jpg`, `webp`, `gif`, `avif`, `svg`, and `bmp`.

```pscript
enum ImageType {
  PNG = 0,
  JPG = 1,
  WEBP = 2,
  GIF = 3,
  AVIF = 4,
  SVG = 5,
  BMP = 6,
  OTHER = 7
}
```

#### 4.7.2. Width & Height

The width and height of the image. Both MUST be a power of 2 and ideally square if possible.

#### 4.7.3. Data

The raw image data. This means if using the browser, the data must be parsed via an `Image` object. For example:

```typescript
const parsePNG = (arrayBuffer: ArrayBuffer): HTMLImageElement => {
    const blob = new Blob([arrayBuffer], { type: "image/png" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.src = url;

    // Clean up after the image is loaded
    img.onload = () => URL.revokeObjectURL(url);

    return img;
};
```

## 5. Utility Functions

This section helps define the pseudo code for functions used frequently throughout the specification.

### 5.1. ZigZag

```pscript
function zigzag(num):
    return (num shifted left by 1) XOR (num shifted right by 31)
```

### 5.2. Weave Functions

```pscript
function weave2D(a, b):
    result = 0
    for I from 0 to 15:
        result = result OR ((a AND 1) shifted left by (I * 2))  // Take ith bit from `a` and put it at position 2*I
        result = result OR ((b AND 1) shifted left by (I * 2 + 1))  // Take ith bit from `b` and put it at position 2*I+1
        a = a shifted right by 1  // Move to next bit
        b = b shifted right by 1  // Move to next bit
    return result
```

### 5.3. Weave Functions 3D

```pscript
function weave3D(a, b, c):
    result = 0
    bigA = a converted to BigInt
    bigB = b converted to BigInt
    bigC = c converted to BigInt

    for I from 0 to 15:
        if (bigA AND 1): result = result OR (1 shifted left by (I * 3))  // Take ith bit from `a` and put it at position 3*I
        if (bigB AND 1): result = result OR (1 shifted left by (I * 3 + 1))  // Take ith bit from `b` and put it at position 3*I+1
        if (bigC AND 1): result = result OR (1 shifted left by (I * 3 + 2))  // Take ith bit from `c` and put it at position 3*I+2
        bigA = bigA shifted right by 1  // Move to the next bit
        bigB = bigB shifted right by 1  // Move to the next bit
        bigC = bigC shifted right by 1  // Move to the next bit

    return result converted to Number
```

### 5.4. Encode Offset

```pscript
function encodeOffset(offset):
    return Math.floor(offset * 1_000)
```

## 6. Security Considerations

It's important to note that this specification is not intended to be used to store sensitive data. Any/all data used by the specification is considered to be publically available.
