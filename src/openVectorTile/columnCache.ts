// import { weaveAndDeltaEncodeArray } from "../util";
import { deltaEncodeArray, deltaDecodeArray } from "../util";
import { readValue } from "./openVectorValue";

import type Protobuf from "../pbf";
import type { OValue, Point, Point3D, VectorLine, VectorLine3D } from "../vectorTile.spec";

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
  values, // features are just values
}

// note: base1 type allows you to decode as needed for each grouping of data.
// for instance OColumnString is an array of strings, but you may only need a few strings on use
export type ColumnValueRead<T> = Array<{ data: T } | { pos: number }>;
export type ColumnValueReadSimple<T> = Array<T | { pos: number }>;
// strings are stored in a column of strings
export type OColumnString<T = string> = ColumnValueReadSimple<T>;
// all base number types are stored together delta encoded.
// So to read them you need to decode the entire group
export type OColumnUnsigned<T = number> = ColumnValueReadSimple<T>;
export type OColumnSigned<T = number> = ColumnValueReadSimple<T>;
export type OColumnDouble<T = number> = ColumnValueReadSimple<T>;
// for geometry types each column is individually weaved and delta encoded
export type OColumnPoints<T = Point> = ColumnValueReadSimple<T>;
export type OColumnPoints3D<T = Point3D> = ColumnValueReadSimple<T>;
export type OColumnLines<T = VectorLine> = ColumnValueReadSimple<T>;
export type OColumnLines3D<T = VectorLine3D> = ColumnValueReadSimple<T>;
// Several ways to use the indices column
// 1. M-Values
// shapes are stored as records of key/values that values are stored in the values column
// but the keys are stored in the shape. This means we have a predifined object that
// can be used to decode the shape keys. The assumption is many M-Values have repeated
// patterns of key/value pairs.
// the key points directly to the strings column, teh value points to the index of the values column
export type OColumnIndices<T = number> = ColumnValueReadSimple<T>;
// values are stored in a manner of looking up string & number column indexes.
export type OColumnValues<T = OValue> = ColumnValueRead<T>;

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
  [OColumnName.values]: OColumnValues = [];
  readonly #pbf: Protobuf;
  constructor(pbf: Protobuf, end = 0) {
    this.#pbf = pbf;
    pbf.readFields(this.#read.bind(this), this, end);
  }

  // Must handle all column types, everyone works the same except for "values" which
  // may have a "pos" key in it
  getColumnData<T>(colIndex: number): T {
    const { col, index } = columnDecode(colIndex);
    return this.getColumn<T>(col, index);
  }

  getColumn<T>(col: OColumnName, index: number): T {
    let res: T;
    const columnValue = this[col][index];
    const hasPos = typeof columnValue === "object" && "pos" in columnValue;
    switch (col) {
      case OColumnName.values: {
        if (hasPos) {
          this[col][index] = { data: this.#getColumnData(col) };
        }
        res = (this[col][index] as { data: T }).data;
        break;
      }
      default: {
        if (hasPos) {
          this[col][index] = this.#getColumnData(col);
        }
        res = this[col][index] as T;
        break;
      }
    }

    return res;
  }

  #getColumnData<T>(colIndex: number): T {
    switch (colIndex) {
      case OColumnName.string:
        return this.#pbf.readString() as T;
      case OColumnName.unsigned:
        return this.#pbf.readVarint() as T;
      case OColumnName.signed:
        return this.#pbf.readSVarint() as T;
      case OColumnName.double:
        return this.#pbf.readDouble() as T;
      // TODO: points, points3D, lines, lines3D
      case OColumnName.indices:
        return deltaDecodeArray(this.#pbf.readPackedVarint()) as T;
      case OColumnName.values:
        return readValue(this.#pbf, this) as T;
      default:
        throw new Error("Unknown column type");
    }
  }

  #read(tag: number, reader: ColumnCacheReader, pbf: Protobuf): void {
    if (tag < 0 || tag > 9) throw new Error("Unknown column type");
    const columnType = tag as OColumnName;
    reader[columnType].push({ pos: pbf.pos });
  }
}

// Numbers track their own index for sorting purposes
export type OColumnBaseChunk<T> = { data: T; index: number };
export type OColumnBaseWrite<T> = OColumnBaseChunk<T>[];
// othwerwise just store the column data
export type OColumnBaseWriteSimple<T> = T[];
// strings are stored in a column of strings
export type OColumnStringWrite<T = string> = OColumnBaseWriteSimple<T>;
// all base number types are stored together delta encoded.
// So to read them you need to decode the entire group
export type OColumnUnsignedWrite<T = number> = OColumnBaseWrite<T>;
export type OColumnSignedWrite<T = number> = OColumnBaseWrite<T>;
export type OColumnDoubleWrite<T = number> = OColumnBaseWrite<T>;
// for geometry types each column is individually weaved and delta encoded
export type OColumnPointsWrite<T = Point> = OColumnBaseWriteSimple<T>;
export type OColumnPoints3DWrite<T = Point3D> = OColumnBaseWriteSimple<T>;
export type OColumnLinesWrite<T = VectorLine> = OColumnBaseWriteSimple<T>;
export type OColumnLines3DWrite<T = VectorLine3D> = OColumnBaseWriteSimple<T>;
// Features should be sorted by id prior to building a column
export type OColumnIndicesWrite<T = number> = OColumnBaseWriteSimple<T>;
// values are stored in a manner of looking up string & number column indexes.
// can be a number (boolean, null, size of array or object) are encoded as numbers,
// the actual pointers to strings&numbers are stored as ptr<{ col: colName, index: index }>
// so that we can sort the strings&numbers before encoding the column
export type ColumnValue = number | { col: SortableColumns; index: number };
export type OColumnValuesWrite<T = ColumnValue[]> = OColumnBaseWriteSimple<T>;
export type SortableColumns = OColumnName.unsigned | OColumnName.signed | OColumnName.double;

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
  [OColumnName.values]: OColumnValuesWrite = [];

  addColumnData<T>(col: OColumnName, value: T): number {
    if (typeof value === "number") {
      throw Error("Use addNumber instead.");
    }

    // look for duplicates
    const values = this[col] as T[];
    const duplicateIndex = values.findIndex((d) => {
      switch (typeof d) {
        case "string":
        case "number":
          return d === value;
        default:
          return JSON.stringify(d) === JSON.stringify(value);
      }
    });
    if (duplicateIndex !== -1) return duplicateIndex;

    // otherwise add
    values.push(value);
    return values.length - 1;
  }

  /**
   * This function is specifically designed for number types as they will be sorted later
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
      columnValue = { data: value, index: column.length } as OColumnBaseChunk<number>;
      column.push(columnValue);
    }

    return { col: columnType, index: columnValue.index };
  }

  // The whole column cache is a message at the tile level.
  // all columns are stored as fields in the message
  // NOTE: You MUST write columns before any other data (layers and features)
  write(column: ColumnCacheWriter, pbf: Protobuf): void {
    this.#sort();
    // for each column, encode apropriately and send to pbf
    for (const string of column[OColumnName.string]) {
      pbf.writeStringField(1, string);
    }
    for (const { data: unsigned } of column[OColumnName.unsigned]) {
      pbf.writeVarintField(2, unsigned);
    }
    for (const { data: signed } of column[OColumnName.signed]) {
      pbf.writeSVarintField(3, signed);
    }
    for (const { data: double } of column[OColumnName.double]) {
      pbf.writeDoubleField(4, double);
    }
    // const points = column[OColumnName.points];
    // const weaveEncodedPoints = weaveAndDeltaEncodeArray(points);
    // pbf.writePackedVarint(5, weaveEncodedPoints);
    // TODO: points3D, lines, lines3D
    pbf.writePackedVarint(6, deltaEncodeArray(column[OColumnName.indices]));

    for (const arr of column[OColumnName.values]) {
      const packed = arr.map((v) => (typeof v === "object" ? columnEncode(v.col, v.index) : v));
      pbf.writePackedVarint(9, packed);
    }
  }

  // Sort number types and value types by index then update the index of each row
  #sort(): void {
    for (const col of [OColumnName.unsigned, OColumnName.signed, OColumnName.double]) {
      this[col as SortableColumns] = this[col as SortableColumns].sort((a, b) => a.index - b.index);
      this[col as SortableColumns].forEach((v, i) => (v.index = i));
    }
  }
}

export function columnEncode(col: OColumnName, index: number): number {
  // column is never bigger then 15
  return (index << 4) + (col & 0xf);
}

export function columnDecode(col: number): { col: OColumnName; index: number } {
  return { col: col & 0xf, index: col >> 4 };
}
