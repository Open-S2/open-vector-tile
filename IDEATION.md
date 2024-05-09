# Open Version

geometry always starts as i32 but will be zigzag encoded to u32 before interleaved then delta encoded

## column types at tile level

* 0 - strings
* 1 - u64
* 2 - i64
* 3 - f64
* 4 - points - interleaved2D + delta encoded
* 5 - lines - interleaved2D + delta encoded (no polygons because polygons point to line indexes)
* 6 - tessellation - interleaved2D + delta encoded
* 7 - indices - delta encoded
* 8 - 3D point - interleaved3D + delta encoded
* 9 - 3D lines - interleaved3D + delta encoded
* 10 - 3D Tesselation - interleaved3D + delta encoded
NOTE: sort features by id
* 11 - ids - delta encoded (this will have an exact length of the number of features) [we can build features from this and types]
* 13 - features (see feature)

Tile: stores the layers and all the columns

## Layer

* CONSTRUCT:
all columns are passed in as an object
BUILD:
* name (column index to layer name is found in keys column)
* extent (encoded as 1 -> 1024, 2 -> 2048, 3 -> 4096, 4 -> 8192).
* feature (will include the id index and type)

## Feature

* CONSTRUCT:
* id is plugged in from the "ids" column
* type (1-6) [so we know which geometry column to use]
* extent is plugged in from the layer
* BUILD:
* offset if applicable (in extent space pull from i64 columns)
* bbox (in world space (lon-lat pulled from f64 columns))
* list of commands + geometry column index
* pointer to indices column index if applicable
* pointer to tessellation column index if applicable
* properties is built from keys and values columns

## Properties encoding

key: column key index -> value -> either a value key index OR
ENCODING: key-value pairs are grouped into a single number and varint encoded
a key will always point to the index of the string column
a value will be the column type (0-3) and the type (nested object, string, number, boolean, null)
