import { readValue } from './vectorValue';
import { deltaDecodeArray, deltaEncodeArray } from '../util';
import {
  unweaveAndDeltaDecode3DArray,
  unweaveAndDeltaDecodeArray,
  weaveAndDeltaEncode3DArray,
  weaveAndDeltaEncodeArray,
} from '../util';

import type { Pbf as Protobuf } from '../pbf';
import type { OValue, Point, Point3D, VectorPoints, VectorPoints3D } from '../vectorTile.spec';

/**
 * Column Types take up 3 bits.
 * ColumnNames define various common data structures to be stored in a column fashion
 */
export enum OColumnName {
  string,
  /** Note: IDs are stored in unsigned */
  unsigned,
  signed,
  // offsets and bbox values are stored in double
  // (lines and polygons have bbox associated with them for zooming)
  double,
  // points is an array of { x: number, y: number }
  // points also stores lines.
  // if a line is stored, note that it has an acompanying offset and potentially mValues
  // Polygons are stored as a collection of lines.
  points,
  points3D,
  // tracking M-values for lines are stored in indices since each m value is just an index to
  // values
  indices,
  values, // features are just values
}

// note: base1 type allows you to decode as needed for each grouping of data.
// for instance OColumnString is an array of strings, but you may only need a few strings on use
/**
 *
 */
export type ColumnValueRead<T> = Array<{ data: T } | { pos: number }>;
/**
 *
 */
export type ColumnValueReadSimple<T> = Array<T | { pos: number }>;
// strings are stored in a column of strings
/**
 *
 */
export type OColumnString<T = string> = ColumnValueReadSimple<T>;
// all base number types are stored together delta encoded.
// So to read them you need to decode the entire group
/**
 *
 */
export type OColumnUnsigned<T = number> = ColumnValueReadSimple<T>;
/**
 *
 */
export type OColumnSigned<T = number> = ColumnValueReadSimple<T>;
/**
 *
 */
export type OColumnDouble<T = number> = ColumnValueReadSimple<T>;
/**
 * for geometry types each column is individually weaved and delta encoded
 */
export type OColumnPoints<T = VectorPoints> = ColumnValueReadSimple<T>;
/**
 *
 */
export type OColumnPoints3D<T = VectorPoints3D> = ColumnValueReadSimple<T>;
// Several ways to use the indices column
// 1. M-Values
// shapes are stored as records of key/values that values are stored in the values column
// but the keys are stored in the shape. This means we have a predifined object that
// can be used to decode the shape keys. The assumption is many M-Values have repeated
// patterns of key/value pairs.
// the key points directly to the strings column, teh value points to the index of the values column
/**
 *
 */
export type OColumnIndices<T = number> = ColumnValueReadSimple<T>;
// values are stored in a manner of looking up string & number column indexes.
/**
 *
 */
export type OColumnValues<T = OValue> = ColumnValueRead<T>;

/**
 *
 */
export class ColumnCacheReader {
  [OColumnName.string]: OColumnString = [];
  [OColumnName.unsigned]: OColumnUnsigned = [];
  [OColumnName.signed]: OColumnSigned = [];
  [OColumnName.double]: OColumnDouble = [];
  [OColumnName.points]: OColumnPoints = [];
  [OColumnName.points3D]: OColumnPoints3D = [];
  [OColumnName.indices]: OColumnIndices = [];
  [OColumnName.values]: OColumnValues = [];
  readonly #pbf: Protobuf;
  /**
   * @param pbf
   * @param end
   */
  constructor(pbf: Protobuf, end = 0) {
    this.#pbf = pbf;
    pbf.readFields(this.#read.bind(this), this, end);
  }

  // Must handle all column types, everyone works the same except for "values" which
  // may have a "pos" key in it
  /**
   * @param colIndex
   */
  getColumnData<T>(colIndex: number): T {
    const { col, index } = columnDecode(colIndex);
    return this.getColumn<T>(col, index);
  }

  /**
   * @param col
   * @param index
   */
  getColumn<T>(col: OColumnName, index: number): T {
    let res: T;
    const columnValue = this[col][index];
    const hasPos = typeof columnValue === 'object' && 'pos' in columnValue;
    if (hasPos) this.#pbf.pos = columnValue.pos;

    if (col === OColumnName.values) {
      if (hasPos) {
        this[col][index] = { data: this.#getColumnData(col) };
      }
      res = (this[col][index] as { data: T }).data;
    } else {
      if (hasPos) {
        this[col][index] = this.#getColumnData(col);
      }
      res = this[col][index] as T;
    }

    return res;
  }

  /**
   * @param colIndex
   * @param col
   */
  #getColumnData<T>(col: OColumnName): T {
    switch (col) {
      case OColumnName.string:
        return this.#pbf.readString() as T;
      case OColumnName.unsigned:
        return this.#pbf.readVarint() as T;
      case OColumnName.signed:
        return this.#pbf.readSVarint() as T;
      case OColumnName.double:
        return this.#pbf.readDouble() as T;
      case OColumnName.points:
        return unweaveAndDeltaDecodeArray(this.#pbf.readPackedVarint()) as T;
      case OColumnName.points3D:
        return unweaveAndDeltaDecode3DArray(this.#pbf.readPackedVarint()) as T;
      case OColumnName.indices:
        return deltaDecodeArray(this.#pbf.readPackedVarint()) as T;
      case OColumnName.values:
        return readValue(this.#pbf, this) as T;
      default:
        throw new Error('Unknown column type');
    }
  }

  /**
   * @param tag
   * @param reader
   * @param pbf
   */
  #read(tag: number, reader: ColumnCacheReader, pbf: Protobuf): void {
    if (tag < 0 || tag > 9) throw new Error('Unknown column type');
    const columnType = tag as OColumnName;
    reader[columnType].push({ pos: pbf.pos });
  }
}

// Numbers track their own index for sorting purposes
/**
 *
 */
export type OColumnBaseChunk<T> = { col: SortableColumns; data: T; index: number };
/**
 *
 */
export type OColumnBaseWrite<T> = OColumnBaseChunk<T>[];
// othwerwise just store the column data
/**
 *
 */
export type OColumnBaseWriteSimple<T> = T[];
// strings are stored in a column of strings
/**
 *
 */
export type OColumnStringWrite<T = string> = OColumnBaseWriteSimple<T>;
// all base number types are stored together delta encoded.
// So to read them you need to decode the entire group
/**
 *
 */
export type OColumnUnsignedWrite<T = number> = OColumnBaseWrite<T>;
/**
 *
 */
export type OColumnSignedWrite<T = number> = OColumnBaseWrite<T>;
/**
 *
 */
export type OColumnDoubleWrite<T = number> = OColumnBaseWrite<T>;
// for geometry types each column is individually weaved and delta encoded
/**
 *
 */
export type OColumnPointsWrite<T = Point> = OColumnBaseWriteSimple<T>;
/**
 *
 */
export type OColumnPoints3DWrite<T = Point3D> = OColumnBaseWriteSimple<T>;
// Features should be sorted by id prior to building a column
/**
 *
 */
export type OColumnIndicesWrite<T = number[]> = OColumnBaseWriteSimple<T>;
// values are stored in a manner of looking up string & number column indexes.
// can be a number (boolean, null, size of array or object) are encoded as numbers,
// the actual pointers to strings&numbers are stored as ptr<{ col: colName, index: index }>
// so that we can sort the strings&numbers before encoding the column
/**
 *
 */
export type ColumnValue = number | { data: unknown; col: SortableColumns; index: number };
/**
 *
 */
export type OColumnValuesWrite<T = ColumnValue[]> = OColumnBaseWriteSimple<T>;
/**
 *
 */
export type SortableColumns = OColumnName.unsigned | OColumnName.signed | OColumnName.double;

/**
 *
 */
export class ColumnCacheWriter {
  [OColumnName.string]: OColumnStringWrite = [];
  [OColumnName.unsigned]: OColumnUnsignedWrite = [];
  [OColumnName.signed]: OColumnSignedWrite = [];
  [OColumnName.double]: OColumnDoubleWrite = [];
  [OColumnName.points]: OColumnPointsWrite = [];
  [OColumnName.points3D]: OColumnPoints3DWrite = [];
  [OColumnName.indices]: OColumnIndicesWrite = [];
  [OColumnName.values]: OColumnValuesWrite = [];

  /**
   * @param col
   * @param value
   */
  addColumnData<T>(col: OColumnName, value: T): number {
    if (typeof value === 'number') {
      throw Error('Use addNumber instead.');
    }

    // look for duplicates
    const colData = this[col] as T[];
    const duplicateIndex = colData.findIndex((d) => {
      switch (typeof d) {
        case 'string':
        case 'number':
          return d === value;
        default:
          return JSON.stringify(d) === JSON.stringify(value);
      }
    });
    if (duplicateIndex !== -1) return duplicateIndex;

    // otherwise add
    colData.push(value);
    return colData.length - 1;
  }

  /**
   * This function is specifically designed for number types as they will be sorted later
   * for better compression.
   * @param value - the number
   * @returns - the ColumnValue reference which contains the index and data.
   * Will be sorted before stored.
   */
  addNumber(value: number): ColumnValue {
    // get column
    const columnType =
      value % 1 === 0
        ? value >= 0
          ? OColumnName.unsigned
          : OColumnName.signed
        : OColumnName.double;

    // get index
    const column = this[columnType] as OColumnBaseChunk<number>[];
    let columnValue = column.find(({ data }) => data === value) as
      | OColumnBaseChunk<number>
      | undefined;
    if (columnValue === undefined) {
      columnValue = {
        col: columnType,
        data: value,
        index: column.length,
      } as OColumnBaseChunk<number>;
      column.push(columnValue);
    }

    return columnValue;
  }

  // The whole column cache is a message at the tile level.
  // all columns are stored as fields in the message
  // NOTE: You MUST write columns before any other data (layers and features)
  /**
   * @param column - the column cache we want to write from
   * @param pbf - the pbf protocol we are writing to
   */
  write(column: ColumnCacheWriter, pbf: Protobuf): void {
    column.#sort();
    // for each column, encode apropriately and send to pbf
    for (const string of column[OColumnName.string]) {
      pbf.writeStringField(OColumnName.string, string);
    }
    for (const { data: unsigned } of column[OColumnName.unsigned]) {
      pbf.writeVarintField(OColumnName.unsigned, unsigned);
    }
    for (const { data: signed } of column[OColumnName.signed]) {
      pbf.writeSVarintField(OColumnName.signed, signed);
    }
    // POTENTAIL FOR SORTING
    // pbf.writePackedVarint(
    //   OColumnName.unsigned,
    //   deltaEncodeSortedArray(column[OColumnName.unsigned].map((v) => v.data)),
    // );
    // pbf.writePackedVarint(
    //   OColumnName.signed,
    //   deltaEncodeSortedArray(column[OColumnName.signed].map((v) => v.data)),
    // );
    for (const { data: double } of column[OColumnName.double]) {
      pbf.writeDoubleField(OColumnName.double, double);
    }
    // points
    pbf.writePackedVarint(OColumnName.points, weaveAndDeltaEncodeArray(column[OColumnName.points]));
    // points 3D:
    pbf.writePackedVarint(
      OColumnName.points3D,
      weaveAndDeltaEncode3DArray(column[OColumnName.points3D]),
    );
    // indices
    for (const indices of column[OColumnName.indices]) {
      pbf.writePackedVarint(OColumnName.indices, deltaEncodeArray(indices));
    }
    // values
    for (const arr of column[OColumnName.values]) {
      const packed = arr.map((v) => (typeof v === 'object' ? columnEncode(v.col, v.index) : v));
      pbf.writePackedVarint(OColumnName.values, packed);
    }
  }

  // Sort number types and value types by index then update the index of each row
  /**
   * Sort the number types for better compression down the line
   */
  #sort(): void {
    for (const col of [OColumnName.unsigned, OColumnName.signed, OColumnName.double]) {
      this[col as SortableColumns] = this[col as SortableColumns].sort((a, b) => a.data - b.data);
      this[col as SortableColumns].forEach((v, i) => (v.index = i));
    }
  }
}

/**
 * @param col - the column in the cache data is stored
 * @param index - the index at said column to find data
 * @returns - the encoded message of the col and index together
 */
export function columnEncode(col: OColumnName, index: number): number {
  // column is never bigger then 3 bits in size
  return (index << 3) + (col & 0x7);
}

/**
 * @param colIndex - the column and index encoded together
 * @returns - the decoded column and index
 */
export function columnDecode(colIndex: number): { col: OColumnName; index: number } {
  return { col: colIndex & 0x7, index: colIndex >> 3 };
}
