import Protobuf from '../pbf.js'
import type {
  OValue
} from '../vectorTile.spec.js'
import type {
  ColumnCacheWriter,
  ColumnCacheReader
} from './columnCache.js'

/**
 * EXPLANATION OF THE CODE:
 *
 * Values are self contained generic types, arrays, or objects.
 * We encode them seperate into a standalone protobuf message.
 * Then we check if that resulting bytes exists in the cache.
 * If not, we add it and write it.
 *
 * Values are also stored in a manner of looking up string & number column indexes.
 * So a value is mostly a collection of lookup devices.
 */

// Write a value to the pbf and return the column index
export function write (cache: ColumnCacheWriter, value: OValue): number {
  // STEP 1: encode a value
  const tmpPbf = new Protobuf()
  writeValue({ value, cache }, tmpPbf)
  const bytes = tmpPbf.finish()
  // Step 2: Send to cache for an index
  return cache.addColumnData(bytes)
}

function writeValue (
  { value, cache }: { value: OValue, cache: ColumnCacheWriter },
  pbf: Protobuf
): void {
  if (value === undefined) return

  if (value === null) {
    pbf.writeTag(0, Protobuf.None)
  } else if (typeof value === 'boolean') {
    if (value) pbf.writeTag(1, Protobuf.None)
    else pbf.writeTag(2, Protobuf.None)
  } else if (
    typeof value === 'number' || typeof value === 'string'
  ) {
    const colIndex = cache.addColumnData(value)
    pbf.writeVarintField(3, colIndex)
  } else if (Array.isArray(value)) {
    // write size
    pbf.writeVarint(value.length)
    // run "writeValue" on all values
    for (const v of value) writeValue({ value: v, cache }, pbf)
  } else if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      // store a null
      pbf.writeTag(0, Protobuf.None)
      return;
    }
    // write size
    pbf.writeVarint(entries.length)
    // run "writeValue" on all values
    for (const [key, v] of entries) {
      writeValue({ value: key, cache }, pbf) // write the string
      writeValue({ value: v, cache }, pbf) // write the value
    }
  } else {
    throw new Error('Cannot encode value type', value)
  }
}

export function read (pbf: Protobuf, cache: ColumnCacheReader, end = 0): OValue {
  const res: { data: OValue } = { data: null }
  pbf.readFields(_read, { value: res, cache }, end)

  return res.data
}

function _read (
  tag: number,
  { value, cache }: { value: { data: OValue }, cache: ColumnCacheReader },
  pbf: Protobuf
): void {
  switch (tag) {
    // data is already null
    case 0: break
    case 1: value.data = true; break
    case 2: value.data = false; break
    // data is a string->unsigned->signed->double
    case 3: {
      value.data = cache.getColumnData(pbf.readVarint())
      break
    }
    // data is an array
    case 4: {
      value.data = []
      const size = pbf.readVarint()
      for (let i = 0; i < size; i++) {
        const nestedData: { data: OValue } = { data: null }
        pbf.readFields(_read, { value: nestedData, cache }, pbf.readVarint() + pbf.pos)
        value.data.push(nestedData.data)
      }
      break
    }
    // data is an object
    case 5: {
      value.data = {}
      const size = pbf.readVarint()
      for (let i = 0; i < size; i++) {
        const nestedData: { data: OValue } = { data: null }
        const key = pbf.readString()
        pbf.readFields(_read, { value: nestedData, cache }, pbf.readVarint() + pbf.pos)
        value.data[key] = nestedData.data
      }
      break
    }
  }
}
