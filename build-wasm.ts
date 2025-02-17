// first convert the wasm file to base64
const data = await Bun.file('./target/wasm32-unknown-unknown/release/optimized.wasm').arrayBuffer();
const uint8Array = new Uint8Array(data);
const base64 = uint8ArrayToBase64(uint8Array);
const code = `export default '${base64}';\n`;
await Bun.write('./src/vectorTile.wasm.ts', code);

/**
 * Helper function to convert Uint8Array to Base64
 * @param array - raw input numbers
 * @returns - Base64 string
 */
function uint8ArrayToBase64(array: Uint8Array): string {
  let binary = '';
  const chunkSize = 1_024; // 1 MB chunks, adjust as needed
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export {};
