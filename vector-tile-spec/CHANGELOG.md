# Open Vector Tile Spec Changelog

## 1.0.0

Initial release.

Features added from Mapbox Vector Tile Spec:

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
* 📷 Supports storing multiple images in the tile.
* 🧇 Supports multiple of any gridded data such as `elevation`, `temperature`, `precipitation`, etc.
