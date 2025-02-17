import wasmBase64 from './vectorTile.wasm.js';

/** An S2CellId is the index pointing to the Rust VectorTile structure in wasm */
export type VectorTileId = number;
/** Free the memory */
// type WasmFreeVectorTile = (ptr: number) => void;
/** Sentinel to allocate memory */
// type WasmAllocSentinel = (size: number) => number;

/**
 * # Open Vector Tile WASM
 * This is a WASM implementation of the Open Vector Tile format.
 * Work in progress. Just for testing purposes currently.
 */
export class VectorTileWASM {
  instance!: WebAssembly.Instance;
  wasmMemory?: Uint8Array;
  tmpString = '';
  // #finalizationRegistry: FinalizationRegistry<number>;
  /** setup */
  constructor() {
    const mod = new WebAssembly.Module(base64ToArrayBuffer(wasmBase64));
    this.instance = new WebAssembly.Instance(mod, {
      env: {},
    });

    // this.#finalizationRegistry = new FinalizationRegistry<number>((id: VectorTileId): void => {
    //   const freeS2CellId = this.instance.exports.free_s2_cell_id as WasmFreeVectorTile;
    //   freeS2CellId(id);
    // });
  }

  // /**
  //  * @param str
  //  * @param options
  //  */
  // shapeString(str: string, options = DEFAULT_OPTIONS): string {
  //   const processText = this.instance.exports.processText as WasmProcessText;
  //   const free = this.instance.exports.free as WasmFree;

  //   if (str.length === 0) return str;

  //   const len = str.length;
  //   // NOTE: putString allocates memory, but processText will free it for us
  //   const ptr = this.#putString(str);
  //   processText(ptr, len, options);
  //   free(ptr, len);
  //   return this.tmpString;
  // }

  // /**
  //  * @param str
  //  */
  // #putString(str: string): number {
  //   const len = str.length;
  //   const buf = new Uint8Array(len);
  //   const ptr = this.#allocUnicodeArray(len);
  //   for (let i = 0; i < len; i++) buf[i] = str.charCodeAt(i);

  //   const view = this.#getMemory();
  //   view.subarray(ptr, ptr + len * 2).set(new Uint8Array(buf.buffer));

  //   return ptr;
  // }

  // /**
  //  * @param ptr
  //  * @param len
  //  */
  // #get(ptr: number, len: number): Uint8Array {
  //   const view = this.#getMemory();
  //   const view16 = new Uint8Array(view.buffer, ptr, len);
  //   const copy = new Uint8Array(len);
  //   for (let i = 0; i < len; i++) copy[i] = view16[i];

  //   return copy;
  // }

  // /**
  //  * @param size
  //  */
  // #allocUnicodeArray(size: number): number {
  //   const allocUnicodeArray = this.instance.exports.allocUnicodeArray as WasmAllocSentinel;
  //   return allocUnicodeArray(size);
  // }

  // /**
  //  *
  //  */
  // #getMemory(): Uint8Array {
  //   const memory = this.instance.exports.memory as WebAssembly.Memory;
  //   if (this.wasmMemory === undefined || this.wasmMemory.buffer !== memory.buffer) {
  //     this.wasmMemory = new Uint8Array(memory.buffer);
  //   }
  //   return this.wasmMemory;
  // }
}

/**
 * polyfill
 * @param base64 - the base64 string
 * @returns - the array buffer of raw bytes
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

  return bytes.buffer as ArrayBuffer;
}
