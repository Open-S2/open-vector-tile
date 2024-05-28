# Open Vector Tile Specification 1.0.0

TODO:

[ ] - Tile Explainer
[ ] - Column Cache
[ ] - Layers
[ ] - Features
  [ ] - Shapes
  [ ] - Feature Properties
  [ ] - M-Values
  [ ] - line offsets
  [ ] - bbox
  [ ] - Points, Lines, Polygons, Points3D, Lines3D, Polygons3D
  [ ] - encoding

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in
this document are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

## 1. Purpose

This document specifies a space-efficient encoding format for tiled geographic vector data. It is designed to be used in browsers or server-side applications for fast rendering or lookups of feature data.

## 2. File Format

The Vector Tile format primarily uses [Google Protocol Buffers](https://developers.google.com/protocol-buffers/) as a encoding format. Protocol Buffers are a language-neutral, platform-neutral extensible mechanism for serializing structured data. Some

### 2.1. File Extension

The filename extension for Vector Tile files SHOULD be `ovt`. For example, a file might be named `vector.ovt`.

### 2.2. Multipurpose Internet Mail Extensions (MIME)

When serving Vector Tiles the MIME type SHOULD be `application/pbf`.

## 3. Projection and Bounds

A Vector Tile represents data based on a square extent within a 0-1 coordinate space. A Vector Tile SHOULD NOT contain information about its bounds and projection. The file format assumes that the decoder knows the bounds and projection of a Vector Tile before decoding it.

[Web Mercator](https://en.wikipedia.org/wiki/Web_Mercator) is the projection of reference, and [the Google tile scheme](http://www.maptiler.org/google-maps-coordinates-tile-bounds-projection/) is the tile extent convention of reference. Together, they provide a 1-to-1 relationship between a specific geographical area, at a specific level of detail, and a path such as `https://example.com/17/65535/43602.ovt`.

Vector Tiles MAY be used to represent data with any projection and tile extent scheme.

## 4. Internal Structure

This specification describes the structure of data within a Vector Tile. The reader should have an understanding of the [Vector Tile protobuf schema document](vector_tile.proto) and the structures it defines.

### 4.1. Tile

A Vector Tile consists of one or more layers and a column-cache system if OVT is used.

### 4.2. Column Cache

### 4.3. Layers

### 4.4. Features

### 4.5. Geometry Encoding

#### 4.5.1. Geometry Types

The `geometry` field is described in each feature by the `type` field which must be a value in the enum `GeomType`. The following geometry types are supported:

* POINTS
* LINESTRINGS
* POLYGONS

Geometry collections are not supported.
