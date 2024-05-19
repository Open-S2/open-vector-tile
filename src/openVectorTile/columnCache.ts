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
  /** stores */
  string,
  /**
   * Note: IDs are stored in unsigned
   * Number types are sorted prior to storing
   */
  unsigned,
  /** Number types are sorted prior to storing */
  signed,
  /**
   * offsets and bbox values are stored in double
   * (lines and polygons have bbox associated with them for zooming)
   * Number types are sorted prior to storing
   */
  double,
  /**
   * points is an array of { x: number, y: number }
   * points also stores lines.
   * if a line is stored, note that it has an acompanying offset and potentially mValues
   * Polygons are stored as a collection of lines.
   * The points feature type that has more than one will be stored here as well.
   */
  points,
  /**
   * points3D is an array of { x: number, y: number, z: number }
   * points3D also stores lines.
   * if a line is stored, note that it has an acompanying offset and potentially mValues
   * Polygons are stored as a collection of lines.
   * The points 3D feature type that has more than one will be stored here as well.
   */
  points3D,
  /**
   * tracking M-values for lines are stored in indices since each m value is just an index to
   * values
   */
  indices,
  /** Values encompasses all properties, m-values, and shapes */
  values,
}

/**
 * Represents a reference to the position in the protobuf to deserialize.
 * @param pos - The position in the protobuf data.
 */
export interface PositionReference {
  pos: number;
}

/**
 * Represents a reference to the position in the protobuf to deserialize.
 * @param pos - The position in the protobuf data.
 */
export interface RawData<T> {
  data: T;
}

/**
 * note: base1 type allows you to decode as needed for each grouping of data.
 * for instance OColumnString is an array of strings, but you may only need a few strings on use.
 * Store either data itself or a reference to the position in the protobuf to deserialize
 * @template T - Any Type
 * @param data - the data parsed and available. Kept to reduce fetch duplication
 * @param pos - the position in the protobuf to fetch the data
 */
export type ColumnValueRead<T> = Array<RawData<T> | PositionReference>;
/**
 * Store either data itself or a reference to the position in the protobuf to deserialize
 * @template T - Any Type; the raw data parsed and available. Kept to reduce fetch duplication
 */
export type ColumnValueReadSimple<T> = Array<T | PositionReference>;
// strings are stored in a column of strings
/**
 * strings are stored in a column of strings
 */
export type OColumnString<T = string> = ColumnValueReadSimple<T>;
// all base number types are stored together delta encoded.
// So to read them you need to decode the entire group
/**
 * unsigned whole numbers are stored in unsigned
 */
export type OColumnUnsigned<T = number> = ColumnValueReadSimple<T>;
/**
 * negative numbers are stored in signed
 */
export type OColumnSigned<T = number> = ColumnValueReadSimple<T>;
/**
 * non-whole numbers are stored in double
 */
export type OColumnDouble<T = number> = ColumnValueReadSimple<T>;
/**
 * for geometry types each column is individually weaved and delta encoded
 */
export type OColumnPoints<T = VectorPoints> = ColumnValueReadSimple<T>;
/**
 * for geometry types each column is individually weaved and delta encoded
 */
export type OColumnPoints3D<T = VectorPoints3D> = ColumnValueReadSimple<T>;
/**
 * Several ways to use the indices column
 * 1. M-Value indexes
 * 2. geometry Indices
 * 3. Shape/Value indexes
 */
export type OColumnIndices<T = number> = ColumnValueReadSimple<T>;
/**
 * values are stored in a manner of looking up string & number column indexes.
 */
export type OColumnValues<T = OValue> = ColumnValueRead<T>;

/**
 * A column index pair for reading
 */
export interface ColumnIndex {
  /** the column in the cache data is stored */
  col: OColumnName;
  /** the index in the column */
  index: number;
}

/**
 * Column Cache Reader
 * Stores all data in a column format.
 * Upon construction, all columns are decoded from the protobuf.
 * This allows for quick and easy access to data in a column format.
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
   * @param pbf - the pbf protocol we are reading from
   * @param end - the position to stop at
   */
  constructor(pbf: Protobuf, end = 0) {
    this.#pbf = pbf;
    pbf.readFields(this.#read.bind(this), this, end);
  }

  // Must handle all column types, everyone works the same except for "values" which
  // may have a "pos" key in it
  /**
   * @param colIndex - an encoded number that contains the column to read from and index in the column
   * @returns - the parsed data
   */
  getColumnData<T>(colIndex: number): T {
    const { col, index } = columnDecode(colIndex);
    return this.getColumn<T>(col, index);
  }

  /**
   * @param col - the column to read/store the parsed data
   * @param index - the index in the column to read/store the parsed data
   * @returns - the parsed data
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
   * @param col - the column to store the parsed data
   * @returns - the parsed data
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
   * @param tag - the tag to explain how to read the following data
   * @param reader - the column cache to read from
   * @param pbf - the protobuf object to read from
   */
  #read(tag: number, reader: ColumnCacheReader, pbf: Protobuf): void {
    if (tag < 0 || tag > 9) throw new Error('Unknown column type');
    const columnType = tag as OColumnName;
    reader[columnType].push({ pos: pbf.pos });
  }
}

/**
 * Numbers track their own index for sorting purposes
 */
export type OColumnBaseChunk<T> = {
  /** The column type */
  col: OColumnName;
  /** The raw data in the column */
  data: T;
  /**
   * The index in the column. Will be updated during the writing phase when converted
   * from a map to an array
   */
  index: number;
};
/**
 * A building block for all column types.
 */
export type OColumnBaseWrite<K, V = K> = Map<K, OColumnBaseChunk<V>>;
/**
 * strings are grouped by their bytes.
 */
export type OColumnStringWrite<T = string> = OColumnBaseWrite<T>;
/**
 * Unsigned integers are sorted prior to storing
 */
export type OColumnUnsignedWrite<T = number> = OColumnBaseWrite<T>;
/**
 * Signed integers are sorted prior to storing
 */
export type OColumnSignedWrite<T = number> = OColumnBaseWrite<T>;
/**
 * Double values are sorted prior to storing
 */
export type OColumnDoubleWrite<T = number> = OColumnBaseWrite<T>;
/**
 * for geometry types each column is individually weaved and delta encoded
 */
export type OColumnPointsWrite<T = Point[]> = OColumnBaseWrite<string, T>;
/**
 * for geometry types each column is individually weaved and delta encoded
 */
export type OColumnPoints3DWrite<T = Point3D[]> = OColumnBaseWrite<string, T>;
/**
 * Features should be sorted by id prior to building a column
 */
export type OColumnIndicesWrite<T = number[]> = OColumnBaseWrite<string, T>;
/**
 * All columns are stored as an object to be able to reference them later.
 * Some columns will use this to sort, others will simply be used to store the raw data.
 */
export interface ColumnValueRef {
  /** The raw data in the column */
  data: unknown;
  /** The column it's stored in */
  col: OColumnName;
  /** The index in the column. Will be updated during the writing phase when converted from a map to an array */
  index: number;
}
/**
 * A value is a collection of lookup devices. A number is decoded by the appropriate function,
 * but the object is a reference to one of the number columns.
 * Number types are eventually sorted, so we track the column and index with the data.
 */
export type ColumnValue = number | ColumnValueRef;
/**
 * All column types that will be written
 */
export type OColumnValuesWrite<T = ColumnValue[]> = OColumnBaseWrite<string, T>;
/**
 * All column types that will be sorted
 */
export type SortableColumns = OColumnName.unsigned | OColumnName.signed | OColumnName.double;

/**
 * The cache where all data is stored in a column format.
 * Each column type has its own array of data.
 * Number types maintain their own index for sorting purposes.
 */
export class ColumnCacheWriter {
  [OColumnName.string]: OColumnStringWrite = new Map<string, OColumnBaseChunk<string>>();
  [OColumnName.unsigned]: OColumnUnsignedWrite = new Map<number, OColumnBaseChunk<number>>();
  [OColumnName.signed]: OColumnSignedWrite = new Map<number, OColumnBaseChunk<number>>();
  [OColumnName.double]: OColumnDoubleWrite = new Map<number, OColumnBaseChunk<number>>();
  [OColumnName.points]: OColumnPointsWrite = new Map<string, OColumnBaseChunk<Point[]>>();
  [OColumnName.points3D]: OColumnPoints3DWrite = new Map<string, OColumnBaseChunk<Point3D[]>>();
  [OColumnName.indices]: OColumnIndicesWrite = new Map<string, OColumnBaseChunk<number[]>>();
  [OColumnName.values]: OColumnValuesWrite = new Map<string, OColumnBaseChunk<ColumnValue[]>>();

  /**
   * @template T - one of the column types
   * @param col - the column to add the value to
   * @param value - the value to add
   * @returns - the index of the value
   */
  addColumnData<T>(col: OColumnName, value: T): number {
    if (typeof value === 'number') throw Error('Use addNumber instead.');
    const type = typeof value;
    const isString = type === 'string';
    const isNumber = type === 'number';
    const key = isString || isNumber ? value : JSON.stringify(value);

    // look for duplicates
    const colData = this[col];
    const data = colData.get(key as string & number);
    if (data !== undefined) return data.index;

    // otherwise add
    // @ts-expect-error - i want to fix this later
    colData.set(key as string & number, { col, data: value, index: colData.size });
    return colData.size - 1;
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
    const column = this[columnType];
    let columnValue = column.get(value);
    // add if not found
    if (columnValue === undefined) {
      columnValue = {
        col: columnType,
        data: value,
        index: column.size,
      } as OColumnBaseChunk<number>;
      column.set(value, columnValue);
    }

    return columnValue;
  }

  /**
   * The whole column cache is a message at the tile level.
   * all columns are stored as fields in the message
   * NOTE: You MUST write columns before any other data (layers and features)
   * @param column - the column cache we want to write from
   * @param pbf - the pbf protocol we are writing to
   */
  write(column: ColumnCacheWriter, pbf: Protobuf): void {
    const unsigned = sortNumbers([...column[OColumnName.unsigned].values()]);
    const signed = sortNumbers([...column[OColumnName.signed].values()]);
    const double = sortNumbers([...column[OColumnName.double].values()]);
    // for each column, encode apropriately and send to pbf
    for (const [string] of column[OColumnName.string]) {
      pbf.writeStringField(OColumnName.string, string);
    }
    for (const u of unsigned) {
      pbf.writeVarintField(OColumnName.unsigned, u.data);
    }
    for (const s of signed) {
      pbf.writeSVarintField(OColumnName.signed, s.data);
    }
    // POTENTAIL FOR SORTING - NOTE: don't see any improvements
    // pbf.writePackedVarint(
    //   OColumnName.unsigned,
    //   deltaEncodeSortedArray(unsigned.map((v) => v.data)),
    // );
    // pbf.writePackedVarint(OColumnName.signed, deltaEncodeSortedArray(signed.map((v) => v.data)));
    for (const d of double) {
      pbf.writeDoubleField(OColumnName.double, d.data);
    }
    // points
    const points = [...column[OColumnName.points].values()];
    for (const p of points) {
      pbf.writePackedVarint(OColumnName.points, weaveAndDeltaEncodeArray(p.data));
    }
    // points 3D:
    const points3D = [...column[OColumnName.points3D].values()];
    for (const p3D of points3D) {
      pbf.writePackedVarint(OColumnName.points3D, weaveAndDeltaEncode3DArray(p3D.data));
    }
    // indices
    const allIndices = [...column[OColumnName.indices].values()];
    for (const indices of allIndices) {
      pbf.writePackedVarint(OColumnName.indices, deltaEncodeArray(indices.data));
    }
    // values
    const allValues = [...column[OColumnName.values].values()];
    for (const arr of allValues) {
      const packed = arr.data.map((v) =>
        typeof v === 'object' ? columnEncode(v.col, v.index) : v,
      );
      pbf.writePackedVarint(OColumnName.values, packed);
    }
  }
}

/**
 * Sort number types and value types by index then update the index of each row for better
 * compression down the line.
 * @param input - an interable array of number columns (contains data and index)
 * @returns - the sorted array
 */
function sortNumbers(input: Array<OColumnBaseChunk<number>>): Array<OColumnBaseChunk<number>> {
  input = input.sort((a, b) => a.data - b.data);
  input.forEach((v, i) => (v.index = i));
  return input;
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
export function columnDecode(colIndex: number): ColumnIndex {
  return { col: colIndex & 0x7, index: colIndex >> 3 };
}
