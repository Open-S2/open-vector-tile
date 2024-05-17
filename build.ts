import bun from 'bun';
/**
 * Builds the project using `bun`
 */
async function build() {
  try {
    console.info('Starting the build process...');
    await bun.build({
      entrypoints: ['src/index.ts'],
      outdir: 'dist',
      format: 'esm',
      minify: true,
      sourcemap: 'external',
      // target: 'esnext', // Adjust target based on your project needs
    });
    console.info('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
  }
}

// Execute the build function
build();
