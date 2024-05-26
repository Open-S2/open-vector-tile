import {
  deltaDecodeArray,
  deltaEncodeArray,
  dequantizeBBox,
  dequantizeBBox3D,
  quantizeBBox,
  unweaveAndDeltaDecode3DArray,
  unweaveAndDeltaDecodeArray,
  weaveAndDeltaEncode3DArray,
  weaveAndDeltaEncodeArray,
} from '../util';

import type { Pbf as Protobuf } from '../pbf';
import type {
  BBox,
  BBox3D,
  Point,
  Point3D,
  VectorPoints,
  VectorPoints3D,
} from '../vectorTile.spec';

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
   * Floating precision helps ensure only 32 bit cost
   * Number types are sorted prior to storing
   */
  float,
  /**
   * worst case, no compression
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
   * store M-Value, Shape, and Value encodings
   * store geometry shapes.
   * store geometry indices.
   */
  indices,
  /** Shapes describe how to rebuild objects */
  shapes,
  /**
   * BBox - specially compressed to reduce byte cost. each value is only 3 bytes worst case
   * BBox3D - specially compressed to reduce byte cost. each value is only 3 bytes worst case.
   * The z values are stored as floats and cost 4 bytes.
   */
  bbox,
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

/**
 * Column Cache Reader
 * Stores all data in a column format.
 * Upon construction, all columns are decoded from the protobuf.
 * This allows for quick and easy access to data in a column format.
 */
export class ColumnCacheReader {
  /** strings are stored in a column of strings */
  [OColumnName.string]: ColumnValueReadSimple<string> = [];
  /** unsigned whole numbers are stored in unsigned */
  [OColumnName.unsigned]: ColumnValueReadSimple<number> = [];
  /** negative numbers are stored in signed */
  [OColumnName.signed]: ColumnValueReadSimple<number> = [];
  /** non-whole 32-bit numbers are stored in float */
  [OColumnName.float]: ColumnValueReadSimple<number> = [];
  /** non-whole numbers greater than 32-bit are stored in double */
  [OColumnName.double]: ColumnValueReadSimple<number> = [];
  /** for geometry types each column is individually weaved and delta encoded */
  [OColumnName.points]: ColumnValueReadSimple<VectorPoints> = [];
  /** for geometry types each column is individually weaved and delta encoded */
  [OColumnName.points3D]: ColumnValueReadSimple<VectorPoints3D> = [];
  /** store M-Value indices, geometry indices, and geometry shapes */
  [OColumnName.indices]: ColumnValueReadSimple<number> = [];
  /** shapes and possibly value indices are stored in a number[] to be decoded by readShape */
  [OColumnName.shapes]: ColumnValueRead<number[]> = [];
  /** Stores both BBox and BBox3D in a single column */
  [OColumnName.bbox]: ColumnValueRead<BBox | BBox3D> = [];

  readonly #pbf: Protobuf;
  /**
   * @param pbf - the pbf protocol we are reading from
   * @param end - the position to stop at
   */
  constructor(pbf: Protobuf, end = 0) {
    this.#pbf = pbf;
    pbf.readFields(this.#read.bind(this), this, end);
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
    const currPos = this.#pbf.pos;
    if (hasPos) this.#pbf.pos = columnValue.pos;

    if (col === OColumnName.shapes) {
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

    // return to original position
    this.#pbf.pos = currPos;

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
      case OColumnName.shapes:
        return this.#pbf.readPackedVarint() as T;
      case OColumnName.bbox: {
        const data = this.#pbf.readBytes();
        if (data.byteLength === 12) {
          return dequantizeBBox(data) as T;
        } else {
          return dequantizeBBox3D(data) as T;
        }
      }
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
    if (tag < 0 || tag > 10) throw new Error('Unknown column type');
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
  /** track how many times this chunk is reused */
  count: number;
};
/**
 * All columns are stored as an object to be able to reference them later.
 * Some columns will use this to sort, others will simply be used to store the raw data.
 */
export type ColumnValueRef = OColumnBaseChunk<unknown>;
/**
 * A value is a collection of lookup devices. A number is decoded by the appropriate function,
 * but the object is a reference to one of the number columns.
 * Number types are eventually sorted, so we track the column and index with the data.
 */
export type ColumnValue = number | ColumnValueRef;
/** A building block for all column types. */
export type OColumnBaseWrite<K, V = K> = Map<K, OColumnBaseChunk<V>>;

/**
 * The cache where all data is stored in a column format.
 * Each column type has its own array of data.
 * Number types maintain their own index for sorting purposes.
 */
export class ColumnCacheWriter {
  /** strings are grouped by their bytes. */
  [OColumnName.string] = new Map<string, OColumnBaseChunk<string>>();
  /** Unsigned integers are sorted prior to storing */
  [OColumnName.unsigned] = new Map<number, OColumnBaseChunk<number>>();
  /** Signed integers are sorted prior to storing */
  [OColumnName.signed] = new Map<number, OColumnBaseChunk<number>>();
  /** 32-bit partial values are sorted prior to storing */
  [OColumnName.float] = new Map<number, OColumnBaseChunk<number>>();
  /** 64-bit partial  values are sorted prior to storing */
  [OColumnName.double] = new Map<number, OColumnBaseChunk<number>>();
  /** for geometry types each column is individually weaved and delta encoded */
  [OColumnName.points] = new Map<string, OColumnBaseChunk<Point[]>>();
  /** for geometry types each column is individually weaved and delta encoded */
  [OColumnName.points3D] = new Map<string, OColumnBaseChunk<Point3D[]>>();
  /** Indices track geometry indices, geometry shapes, or other indexing data */
  [OColumnName.indices] = new Map<string, OColumnBaseChunk<number[]>>();
  /** Contains number arrays of how to rebuild objects */
  [OColumnName.shapes] = new Map<string, OColumnBaseChunk<ColumnValue[]>>();
  /** Features should be sorted by id prior to building a column */
  [OColumnName.bbox] = new Map<string, OColumnBaseChunk<BBox | BBox3D>>();

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
    const key =
      isString || isNumber
        ? value
        : // we need to simplify value keys to only include the column and data for better matching.
          col === OColumnName.shapes
          ? JSON.stringify(
              (value as ColumnValue[]).map((v) =>
                typeof v === 'number' ? v : { col: v.col, data: v.data },
              ),
            )
          : 'data' in (value as ColumnValueRef)
            ? JSON.stringify((value as ColumnValueRef).data)
            : JSON.stringify(value);

    // look for duplicates
    const colData = this[col];
    const data = colData.get(key as string & number);
    if (data !== undefined) {
      data.count++;
      return data.index;
    }

    // otherwise add
    // @ts-expect-error - i want to fix this later
    colData.set(key as string & number, { col, data: value, index: colData.size, count: 1 });
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
        count: 0,
      } as OColumnBaseChunk<number>;
      column.set(value, columnValue);
    }

    // increment count
    columnValue.count++;

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
    const unsigned = sortColumn([...column[OColumnName.unsigned].values()]);
    const signed = sortColumn([...column[OColumnName.signed].values()]);
    const float = sortColumn([...column[OColumnName.float].values()]);
    const double = sortColumn([...column[OColumnName.double].values()]);
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
    for (const f of float) {
      pbf.writeFloatField(OColumnName.float, f.data);
    }
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
    // shapes
    const allShapes = [...column[OColumnName.shapes].values()];
    for (const arr of allShapes) {
      const packed = arr.data.map((v) => (typeof v === 'object' ? v.index : v));
      pbf.writePackedVarint(OColumnName.shapes, packed);
    }
    // bbox
    const allBBox = [...column[OColumnName.bbox].values()];
    for (const bbox of allBBox) {
      const data = quantizeBBox(bbox.data);
      const dataBuf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      pbf.writeBytesField(OColumnName.bbox, dataBuf);
    }
  }
}

/**
 * Sort number types and value types by index then update the index of each row for better
 * compression down the line.
 * @param input - an interable array of number columns (contains data and index)
 * @returns - the sorted array
 */
function sortColumn(input: Array<OColumnBaseChunk<number>>): Array<OColumnBaseChunk<number>> {
  input = input.sort((a, b) => {
    const count = b.count - a.count;
    if (count !== 0) return count;
    return a.data - b.data;
  });
  input.forEach((v, i) => (v.index = i));
  return input;
}
