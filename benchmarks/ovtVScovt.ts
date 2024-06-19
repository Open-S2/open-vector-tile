import fs from 'fs';
import path from 'path';

import { markdownTable } from 'markdown-table';
import { VectorTile, writeOVTile } from '../src';
import { brotliCompressSync, gzipSync } from 'zlib';

/** Finding the averages for each zoom or all */
interface AverageTracker {
  sum: number;
  total: number;
  average: number;
}

/** Find the averages for each zoom and total */
interface SizeBenchmarks {
  all: AverageTracker;
  [zoom: number]: AverageTracker;
}

/** compression is either raw, gzip, or brotli */
interface CompressionBenchmarks {
  raw: SizeBenchmarks;
  gzip: SizeBenchmarks;
  brotli: SizeBenchmarks;
}

/** Finding the averages for each format */
interface AllSizeBenchmarks {
  covt: CompressionBenchmarks;
  mvt: CompressionBenchmarks;
  ovt: CompressionBenchmarks;
}

const RULES = [
  { folder: 'amazon', fileType: 'pbf' },
  // { folder: 'test', fileType: 'pbf' },
  // { folder: 'amazon_here', fileType: 'pbf' },
  // { folder: 'bing', fileType: 'mvt' },
  // { folder: 'omt', fileType: 'mvt' },
];

const sizeBenchmarks: AllSizeBenchmarks = {
  covt: {
    raw: { all: { sum: 0, total: 0, average: 0 } },
    gzip: { all: { sum: 0, total: 0, average: 0 } },
    brotli: { all: { sum: 0, total: 0, average: 0 } },
  },
  mvt: {
    raw: { all: { sum: 0, total: 0, average: 0 } },
    gzip: { all: { sum: 0, total: 0, average: 0 } },
    brotli: { all: { sum: 0, total: 0, average: 0 } },
  },
  ovt: {
    raw: { all: { sum: 0, total: 0, average: 0 } },
    gzip: { all: { sum: 0, total: 0, average: 0 } },
    brotli: { all: { sum: 0, total: 0, average: 0 } },
  },
};

for (const { folder, fileType } of RULES) {
  // console.info(`${folder}`);
  const fileList = getFileList(folder);

  for (const { fileName, zoom } of fileList) {
    const sizes = buildFilesizeBenchmarks(folder, fileName, fileType);
    addBench(sizeBenchmarks, sizes, zoom);
  }

  buildAverages(sizeBenchmarks);
}

const tables = buildTables(sizeBenchmarks);
for (const table in tables) {
  console.info(`\n${table.toUpperCase()}:\n`);
  const tablePretty = markdownTable(tables[table], {
    align: ['l', 'r', 'r', 'r'],
    padding: true,
  });
  console.info(tablePretty);
}

/**
 * @param benchmarks - all size benchmarks
 * @param sizes - all compression types to add
 * @param zoom - the zoom at which we analyzed
 */
function addBench(benchmarks: AllSizeBenchmarks, sizes: AllFileSizes, zoom: number): void {
  for (const tileFormat in sizes) {
    const compressions = sizes[tileFormat] as FileSizes;
    for (const compress in compressions) {
      const compressValue = compressions[compress] as number;
      if (benchmarks[tileFormat][compress][zoom] === undefined) {
        benchmarks[tileFormat][compress][zoom] = { sum: 0, total: 0, average: 0 };
      }
      benchmarks[tileFormat][compress][zoom].sum += compressValue;
      benchmarks[tileFormat][compress][zoom].total++;
      benchmarks[tileFormat][compress].all.sum += compressValue;
      benchmarks[tileFormat][compress].all.total++;
    }
  }
}

/**
 * @param benchmarks - all size benchmarks
 */
function buildAverages(benchmarks: AllSizeBenchmarks) {
  for (const tileFormat in benchmarks) {
    for (const compressionType in benchmarks[tileFormat]) {
      for (const zoom in benchmarks[tileFormat][compressionType]) {
        benchmarks[tileFormat][compressionType][zoom].average =
          benchmarks[tileFormat][compressionType][zoom].sum /
          benchmarks[tileFormat][compressionType][zoom].total;
      }
    }
  }
}

/**
 * @param folder - head dir folder name to parse
 * @returns list of file names
 */
function getFileList(folder: string): { fileName: string; zoom: number }[] {
  const files = fs.readdirSync(`./benchmarks/data/${folder}/covt`);
  return files.map((file) => {
    const fileName = file.split('.')[0];
    const zoom = fileName.split('_')[0];
    return { fileName, zoom: parseInt(zoom) };
  });
}

/**
 * Get the file sizes for compression format
 */
interface FileSizes {
  raw: number;
  gzip: number;
  brotli: number;
}

/**
 * Get file sizes for every vector format
 */
interface AllFileSizes {
  covt: FileSizes;
  mvt: FileSizes;
  ovt: FileSizes;
}

/**
 * From each file build normal, gzip, and brotli for:
 * - MVT
 * - COVT
 * - OVT
 * @param folder - head dir folder name
 * @param xyz - will be the file name like "z_x_y.pbf" without the pbf
 * @param fileType - in the mvt folder sometimes its pbf, sometimes its mvt
 * @returns AllFileSizes and compression formats for each tile format
 */
function buildFilesizeBenchmarks(folder: string, xyz: string, fileType: string): AllFileSizes {
  const MVT = fs.readFileSync(
    path.join(__dirname, `../benchmarks/data/${folder}/mvt/${xyz}.${fileType}`),
  );
  const COVT = fs.readFileSync(
    path.join(__dirname, `../benchmarks/data/${folder}/covt/${xyz}.covt`),
  );
  const tile = new VectorTile(new Uint8Array(MVT));

  const OVT = writeOVTile(tile);

  return {
    covt: {
      raw: COVT.length,
      gzip: gzipSync(COVT).length,
      brotli: brotliCompressSync(COVT).length,
    },
    mvt: {
      raw: MVT.length,
      gzip: gzipSync(MVT).length,
      brotli: brotliCompressSync(MVT).length,
    },
    ovt: {
      raw: OVT.length,
      gzip: gzipSync(OVT).length,
      brotli: brotliCompressSync(OVT).length,
    },
  };
}

/**
 * Filesize Benchmarks setup for pretty table printing
 */
// type BenchTable = Array<{
//   zoom: string;
//   average: number;
//   format: 'mvt' | 'covt' | 'ovt';
//   percentMVT: number;
// }>;
type BenchTable = Array<
  [
    string, // zoom
    number, // average
    string, // format: 'mvt' | 'covt' | 'ovt';
    number, // percentMVT: number;
  ]
>;

/**
 * Filesize Benchmarks setup for pretty table printing
 */
interface BenchTables {
  raw: BenchTable;
  gzip: BenchTable;
  brotli: BenchTable;
}

/**
 * @param benchmarks - all size benchmarks
 * @returns all the benchmarks in a table format
 */
function buildTables(benchmarks: AllSizeBenchmarks): BenchTables {
  const benchTables = {
    raw: [['zoom', 'mvt', 'covt', 'ovt']],
    gzip: [['zoom', 'mvt', 'covt', 'ovt']],
    brotli: [['zoom', 'mvt', 'covt', 'ovt']],
  };
  // match a zoom to the table index. I did the benchmark storage backwards -_-
  const zoomTable: { [zoom: number]: number } = {};
  let zoomIndex = 1;

  for (const tileFormat in benchmarks) {
    const formats = benchmarks[tileFormat];
    for (const compress in formats) {
      const compressions = formats[compress];
      for (const zoom in compressions) {
        if (zoomTable[zoom] === undefined) {
          zoomTable[zoom] = zoomIndex;
          zoomIndex++;
        }
        const compressValue = compressions[zoom];
        const compressTable = benchTables[compress];
        const tableIndex = zoomTable[zoom];
        const average = formatBytes(compressValue.average);
        if (compressTable[tableIndex] === undefined) {
          compressTable[tableIndex] = [zoom];
        }
        if (tileFormat === 'mvt') {
          compressTable[tableIndex][1] = average;
        } else if (tileFormat === 'covt') {
          compressTable[tableIndex][2] = average;
        } else if (tileFormat === 'ovt') {
          compressTable[tableIndex][3] = average;
        }
      }
    }
  }

  // @ts-expect-error - the first line will be all strings
  return benchTables;
}

/**
 * @param bytes - number of bytes
 * @returns formatted bytes
 */
function formatBytes(bytes: number): string {
  return (bytes / 1024).toFixed(2) + ' kB';
}

// BING WITH GZIP FOR STRINGS:

// RAW:

// | zoom |       mvt |      covt |       ovt |
// | :--- | --------: | --------: | --------: |
// | 4    | 226.50 kB | 138.31 kB | 281.19 kB |
// | 5    | 153.46 kB | 106.47 kB | 185.37 kB |
// | 6    |  61.30 kB |  75.66 kB |  70.09 kB |
// | 7    | 116.11 kB | 104.21 kB | 137.74 kB |
// | 9    |  96.45 kB |  80.12 kB | 110.60 kB |
// | 11   |  51.80 kB |  41.01 kB |  56.69 kB |
// | all  | 128.73 kB |  99.71 kB | 154.29 kB |

// BROTLI:

// | zoom |       mvt |      covt |       ovt |
// | :--- | --------: | --------: | --------: |
// | 4    | 123.88 kB | 116.25 kB | 145.00 kB |
// | 5    |  94.85 kB |  92.19 kB | 108.13 kB |
// | 6    |  43.43 kB |  48.46 kB |  48.30 kB |
// | 7    |  81.68 kB |  74.46 kB |  91.27 kB |
// | 9    |  73.23 kB |  61.98 kB |  79.48 kB |
// | 11   |  39.65 kB |  31.04 kB |  41.08 kB |
// | all  |  82.87 kB |  77.94 kB |  93.63 kB |

// BING WITHOUT GZIP FOR STRINGS:

// RAW:

// | zoom |       mvt |      covt |       ovt |
// | :--- | --------: | --------: | --------: |
// | 4    | 226.50 kB | 138.31 kB | 281.84 kB |
// | 5    | 153.46 kB | 106.47 kB | 186.20 kB |
// | 6    |  61.30 kB |  75.66 kB |  70.70 kB |
// | 7    | 116.11 kB | 104.21 kB | 138.40 kB |
// | 9    |  96.45 kB |  80.12 kB | 111.28 kB |
// | 11   |  51.80 kB |  41.01 kB |  57.88 kB |
// | all  | 128.73 kB |  99.71 kB | 155.01 kB |

// BROTLI:

// | zoom |       mvt |      covt |       ovt |
// | :--- | --------: | --------: | --------: |
// | 4    | 123.88 kB | 116.25 kB | 144.72 kB |
// | 5    |  94.85 kB |  92.19 kB | 108.06 kB |
// | 6    |  43.43 kB |  48.46 kB |  48.35 kB |
// | 7    |  81.68 kB |  74.46 kB |  91.23 kB |
// | 9    |  73.23 kB |  61.98 kB |  79.41 kB |
// | 11   |  39.65 kB |  31.04 kB |  41.19 kB |
// | all  |  82.87 kB |  77.94 kB |  93.56 kB |

// ------------------------------------------------------

// OMT WITH GZIP FOR STRINGS:
// RAW:

// | zoom |       mvt |      covt |       ovt |
// | :--- | --------: | --------: | --------: |
// | 2    | 564.99 kB | 302.85 kB | 307.40 kB |
// | 3    | 385.14 kB | 261.98 kB | 207.72 kB |
// | 4    | 942.42 kB | 226.45 kB | 745.77 kB |
// | 5    | 817.49 kB | 189.61 kB | 592.92 kB |
// | 6    | 588.45 kB | 156.18 kB | 438.18 kB |
// | 7    | 524.11 kB | 154.58 kB | 385.31 kB |
// | 8    | 421.56 kB | 115.47 kB | 299.91 kB |
// | 9    | 298.35 kB |  97.19 kB | 304.78 kB |
// | 10   | 150.17 kB |  59.64 kB | 146.18 kB |
// | 11   |  93.95 kB |  38.03 kB |  89.20 kB |
// | 12   | 165.01 kB |  59.31 kB | 142.50 kB |
// | 13   |  93.35 kB |  47.59 kB |  89.49 kB |
// | 14   | 627.96 kB | 310.42 kB | 516.24 kB |
// | all  | 348.00 kB | 121.23 kB | 279.84 kB |

// BROTLI:

// | zoom |       mvt |      covt |       ovt |
// | :--- | --------: | --------: | --------: |
// | 2    | 165.15 kB | 162.54 kB | 170.38 kB |
// | 3    | 128.56 kB | 119.23 kB | 124.37 kB |
// | 4    | 189.59 kB | 155.75 kB | 184.92 kB |
// | 5    | 149.38 kB | 113.93 kB | 141.56 kB |
// | 6    | 119.55 kB | 110.58 kB | 119.84 kB |
// | 7    | 112.47 kB |  92.03 kB | 112.60 kB |
// | 8    |  89.51 kB |  72.89 kB |  88.92 kB |
// | 9    | 124.31 kB |  75.95 kB | 125.72 kB |
// | 10   |  70.74 kB |  47.94 kB |  69.14 kB |
// | 11   |  45.58 kB |  30.03 kB |  43.26 kB |
// | 12   |  70.61 kB |  47.95 kB |  68.49 kB |
// | 13   |  50.47 kB |  39.23 kB |  49.69 kB |
// | 14   | 289.42 kB | 217.45 kB | 271.89 kB |
// | all  | 111.25 kB |  83.81 kB | 108.22 kB |

// OMT WITHOUT GZIP FOR STRINGS:

// RAW:

// | zoom |       mvt |      covt |       ovt |
// | :--- | --------: | --------: | --------: |
// | 2    | 564.99 kB | 302.85 kB | 404.67 kB |
// | 3    | 385.14 kB | 261.98 kB | 288.13 kB |
// | 4    | 942.42 kB | 226.45 kB | 782.76 kB |
// | 5    | 817.49 kB | 189.61 kB | 622.70 kB |
// | 6    | 588.45 kB | 156.18 kB | 459.02 kB |
// | 7    | 524.11 kB | 154.58 kB | 398.73 kB |
// | 8    | 421.56 kB | 115.47 kB | 307.05 kB |
// | 9    | 298.35 kB |  97.19 kB | 311.59 kB |
// | 10   | 150.17 kB |  59.64 kB | 149.94 kB |
// | 11   |  93.95 kB |  38.03 kB |  91.68 kB |
// | 12   | 165.01 kB |  59.31 kB | 143.87 kB |
// | 13   |  93.35 kB |  47.59 kB |  90.28 kB |
// | 14   | 627.96 kB | 310.42 kB | 555.05 kB |
// | all  | 348.00 kB | 121.23 kB | 293.08 kB |

// BROTLI:

// | zoom |       mvt |      covt |       ovt |
// | :--- | --------: | --------: | --------: |
// | 2    | 165.15 kB | 162.54 kB | 171.90 kB |
// | 3    | 128.56 kB | 119.23 kB | 126.79 kB |
// | 4    | 189.59 kB | 155.75 kB | 184.53 kB |
// | 5    | 149.38 kB | 113.93 kB | 143.48 kB |
// | 6    | 119.55 kB | 110.58 kB | 120.74 kB |
// | 7    | 112.47 kB |  92.03 kB | 112.66 kB |
// | 8    |  89.51 kB |  72.89 kB |  89.74 kB |
// | 9    | 124.31 kB |  75.95 kB | 125.79 kB |
// | 10   |  70.74 kB |  47.94 kB |  69.39 kB |
// | 11   |  45.58 kB |  30.03 kB |  43.49 kB |
// | 12   |  70.61 kB |  47.95 kB |  68.65 kB |
// | 13   |  50.47 kB |  39.23 kB |  49.68 kB |
// | 14   | 289.42 kB | 217.45 kB | 272.59 kB |
// | all  | 111.25 kB |  83.81 kB | 108.63 kB |
