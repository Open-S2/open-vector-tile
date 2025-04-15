export * from './base/index.js';
export * from './open/index.js';
export * from './mapbox/index.js';
export * from './util.js';
export * from './vectorTile.spec.js';
export * from './vectorTile.js';
export * from './vectorTileWASM.js';

import ShapeSchema from './open/shape.schema.json' with { type: 'json' };
export { ShapeSchema };
