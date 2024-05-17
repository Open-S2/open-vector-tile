import { OColumnName, columnDecode, columnEncode } from '../../src/openVectorTile/columnCache';
import { describe, expect, it } from 'bun:test';

describe('columnEncode and columnDecode', () => {
  it('encodes', () => {
    expect(columnEncode(OColumnName.unsigned, 3)).toBe(25);
    expect(columnEncode(OColumnName.values, 7)).toBe(63);
  });

  it('decodes', () => {
    expect(columnDecode(25)).toEqual({ col: OColumnName.unsigned, index: 3 });
    expect(columnDecode(63)).toEqual({ col: OColumnName.values, index: 7 });
  });
  it('encodes and decodes', () => {
    expect(columnDecode(columnEncode(OColumnName.unsigned, 3))).toEqual({
      col: OColumnName.unsigned,
      index: 3,
    });
    expect(columnDecode(columnEncode(OColumnName.values, 7))).toEqual({
      col: OColumnName.values,
      index: 7,
    });
  });
});
