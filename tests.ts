function interweave2D (a: number, b: number): number {
    let result = 0;
    for (let i = 0; i < 16; i++) {
        result |= (a & 1) << (i * 2); // Take ith bit from `a` and put it at position 2*i
        result |= (b & 1) << (i * 2 + 1); // Take ith bit from `b` and put it at position 2*i+1
        // move to next bit
        a >>= 1
        b >>= 1
        if (a === 0 && b === 0) break;
    }
    return result >>> 0; // Convert to unsigned 32-bit integer
}

function interweave3D (a: number, b: number, c: number): number {
    let result = 0
    for (let i = 0; i < 16; i++) {
        result |= (a & 1) << (i * 3) // Take ith bit from `a` and put it at position 3*i
        result |= (b & 1) << (i * 3 + 1) // Take ith bit from `b` and put it at position 3*i+1
        result |= (c & 1) << (i * 3 + 2) // Take ith bit from `c` and put it at position 3*i+2
        // move to next bit
        a >>= 1
        b >>= 1
        c >>= 1
        if (a === 0 && b === 0 && c === 0) break
    }
    return result >>> 0 // Convert to unsigned 32-bit integer
}

// Example usage:
// const a = 0b1011; // 11 in decimal
// const b = 0b0011; // 3 in decimal
const a = 1_324
const b = 1_324
console.log(a, b)
console.log(interweave2D(a, b).toString(2)); // Output should be "1001111" in binary
console.log(interweave2D(a, b)); // Output should be 79 in decimal
// console.log(Number(1_324).toString(2)) // 10100101100

const aa = 0b1011; // 11 in decimal
const bb = 0b0011; // 3 in decimal
const cc = 0b1111; // 15 in decimal
console.log(aa, bb, cc)
console.log(interweave3D(aa, bb, cc).toString(2)); // Output should be "11111111" in binary
console.log(interweave3D(aa, bb, cc)); // Output should be 255 in decimal

// 0b11111111 - 8bit binary number

// 10110011111

// 1_324
// u16::Max - 65_535
//
// 1324 1324
// 1100110000110011110000 - 3 sets of 8 bits
// 1100110000110011110000
// 3345648