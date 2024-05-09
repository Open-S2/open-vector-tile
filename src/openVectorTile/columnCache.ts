import { weaveAndDeltaEncodeArray } from '../util.js'

import type Protobuf from '../pbf.js'
import type {
  OValue,
  Point,
  Point3D,
  VectorLine,
  VectorLine3D
} from '../vectorTile.spec.js'

export enum OColumnName {
  string,
  unsigned, // IDs are stored in unsigned
  signed,
  double, // offsets and bbox values are stored in double (lines and polygons have bbox associated with them for zooming)
  points,
  points3D,
  // NOTE: everytime a line is stored, an acompanying offset is stored. so pbf writes: offset, size, data
  lines, // tessellation is stored in lines
  lines3D, // tessellation3D is stored in lines3D
  indices, // tracking M-values for lines are stored in indices since each m value is just an index to values
  values // features are just values
}

// note: base1 type allows you to decode as needed for each grouping of data.
// for instance OColumnString is an array of strings, but you may only need a few strings on use
export type OColumnBase<T> = Array<{ data: T } | { pos: number }>
// strings are stored in a column of strings
export type OColumnString<T = string> = OColumnBase<T>
// all base number types are stored together delta encoded.
// So to read them you need to decode the entire group
export type OColumnUnsigned<T = number> = OColumnBase<T>
export type OColumnSigned<T = number> = OColumnBase<T>
export type OColumnDouble<T = number> = OColumnBase<T>
// for geometry types each column is individually weaved and delta encoded
export type OColumnPoints<T = Point> = OColumnBase<T>
export type OColumnPoints3D<T = Point3D> = OColumnBase<T>
export type OColumnLines<T = VectorLine> = OColumnBase<T>
export type OColumnLines3D<T = VectorLine3D> = OColumnBase<T>
// Features should be sorted by id prior to building a column
export type OColumnIndices<T = number> = OColumnBase<T>
// values are stored in a manner of looking up string & number column indexes.
export type OColumnValues<T = OValue> = OColumnBase<T>

export class ColumnCacheReader {
  [OColumnName.string]: OColumnString = [];
  [OColumnName.unsigned]: OColumnUnsigned = [];
  [OColumnName.signed]: OColumnSigned = [];
  [OColumnName.double]: OColumnDouble = [];
  [OColumnName.points]: OColumnPoints = [];
  [OColumnName.points3D]: OColumnPoints3D = [];
  [OColumnName.lines]: OColumnLines = [];
  [OColumnName.lines3D]: OColumnLines3D = [];
  [OColumnName.indices]: OColumnIndices = [];
  [OColumnName.values]: OColumnValues = []
  readonly #pbf: Protobuf
  constructor (pbf: Protobuf, end = 0) {
    this.#pbf = pbf
    pbf.readFields(this.#read.bind(this), this, end)
  }

  getColumnData<T> (colIndex: number): T {
    const { col, index } = columnDecode(colIndex)
    let columnIndex = this[col][index]
    if ('pos' in columnIndex) {
      // request pbf to read the string
      this.#pbf.pos = columnIndex.pos
      columnIndex = this[col][index] = { data: this.#getColumnData(col) }
    }

    return columnIndex.data as T
  }

  #getColumnData<T> (colIndex: number): T {
    switch (colIndex) {
      case OColumnName.string: return this.#pbf.readString() as T
      case OColumnName.unsigned: return this.#pbf.readVarint() as T
      case OColumnName.signed: return this.#pbf.readSVarint() as T
      case OColumnName.double: return this.#pbf.readDouble() as T
      // TODO: points, points3D, lines, lines3D, indices, values
      default: throw new Error('Unknown column type')
    }
  }

  #read (tag: number, reader: ColumnCacheReader, pbf: Protobuf): void {
    // TODO
  }
}

export type OColumnBaseWrite<T> = T[]
// strings are stored in a column of strings
export type OColumnStringWrite<T = string> = OColumnBaseWrite<T>
// all base number types are stored together delta encoded.
// So to read them you need to decode the entire group
export type OColumnUnsignedWrite<T = number> = OColumnBaseWrite<T>
export type OColumnSignedWrite<T = number> = OColumnBaseWrite<T>
export type OColumnDoubleWrite<T = number> = OColumnBaseWrite<T>
// for geometry types each column is individually weaved and delta encoded
export type OColumnPointsWrite<T = Point> = OColumnBaseWrite<T>
export type OColumnPoints3DWrite<T = Point3D> = OColumnBaseWrite<T>
export type OColumnLinesWrite<T = VectorLine> = OColumnBaseWrite<T>
export type OColumnLines3DWrite<T = VectorLine3D> = OColumnBaseWrite<T>
// Features should be sorted by id prior to building a column
export type OColumnIndicesWrite<T = number> = OColumnBaseWrite<T>
// values are stored in a manner of looking up string & number column indexes.
export type OColumnValuesWrite<T = OValue> = OColumnBaseWrite<T>

export class ColumnCacheWriter {
  [OColumnName.string]: OColumnStringWrite = [];
  [OColumnName.unsigned]: OColumnUnsignedWrite = [];
  [OColumnName.signed]: OColumnSignedWrite = [];
  [OColumnName.double]: OColumnDoubleWrite = [];
  [OColumnName.points]: OColumnPointsWrite = [];
  [OColumnName.points3D]: OColumnPoints3DWrite = [];
  [OColumnName.lines]: OColumnLinesWrite = [];
  [OColumnName.lines3D]: OColumnLines3DWrite = [];
  [OColumnName.indices]: OColumnIndicesWrite = [];
  [OColumnName.values]: OColumnValuesWrite = []
  // This function is specifically designed for base types string and number
  addColumnData<T> (value: T): number {
    // get column
    let columnType: OColumnName
    switch (typeof value) {
      case 'string': columnType = OColumnName.string; break
      case 'number': {
        columnType = value % 1 === 0
          ? value >= 0 ? OColumnName.unsigned : OColumnName.signed
          : OColumnName.double
        break
      }
      // TODO: points, points3D, lines, lines3D, indices, values
      default:
        throw new Error('Unsupported column type')
    }

    // get index
    const column = this[columnType] as T[]
    let index = column.indexOf(value)
    if (index !== -1) {
      column.push(value)
      index = column.length - 1
    }

    return columnEncode(columnType, index)
  }

  // The whole column cache is a message at the tile level.
  // all columns are stored as fields in the message
  static write (column: ColumnCacheWriter, pbf: Protobuf): void {
    // for each column, encode apropriately and send to pbf
    for (const string of column[OColumnName.string]) {
      pbf.writeStringField(1, string)
    }
    for (const unsigned of column[OColumnName.unsigned]) {
      pbf.writeVarintField(2, unsigned)
    }
    for (const signed of column[OColumnName.signed]) {
      pbf.writeSVarintField(3, signed)
    }
    for (const double of column[OColumnName.double]) {
      pbf.writeDoubleField(4, double)
    }
    const points = column[OColumnName.points]
    const weaveEncodedPoints = weaveAndDeltaEncodeArray(points)
    pbf.writePackedVarint(5, weaveEncodedPoints)
    // TODO: points3D, lines, lines3D, indices, values
  }
}

export function columnEncode (col: OColumnName, index: number): number {
  // column is never bigger then 15
  return (index << 4) + (col & 0xf)
}

export function columnDecode (col: number): { col: OColumnName, index: number } {
  return { col: col & 0xf, index: col >> 4 }
}
