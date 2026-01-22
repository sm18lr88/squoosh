import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

// Plugin to handle add-css: imports (used for CSS in the app)
function addCssPlugin(): Plugin {
  return {
    name: 'add-css-plugin',
    resolveId(id) {
      if (id.startsWith('add-css:')) {
        return { id, external: false };
      }
      return null;
    },
    load(id) {
      if (id.startsWith('add-css:')) {
        return 'export default {}';
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [addCssPlugin()],
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/cli/**/*.ts', 'src/client/**/*.ts', 'src/client/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.d.ts',
        // Exclude WASM wrapper modules - these are integration code that
        // load and call WASM modules at runtime. They can't be meaningfully
        // unit tested without the actual WASM binaries.
        'src/cli/codecs/encoders/*.ts',
        'src/cli/codecs/decoders/*.ts',
        'src/cli/codecs/native-backend.ts',
        'src/cli/codecs/sharp-backend.ts',
        // Exclude interactive prompts - these depend on user input
        'src/cli/interactive/*.ts',
        // Exclude CLI entry point - tested through integration tests
        'src/cli/index.ts',
        // Exclude batch orchestrator - depends on WASM codecs
        'src/cli/batch/index.ts',
        // Exclude CLI server - requires integration testing with actual HTTP server
        'src/cli/server/index.ts',
        // Exclude client code that depends on WASM/Workers
        'src/client/lazy-app/worker-bridge/**/*.ts',
        'src/client/lazy-app/Compress/**/*.ts',
        'src/client/lazy-app/Compress/**/*.tsx',
        // Exclude feature-meta - depends on encoders
        'src/client/lazy-app/feature-meta.ts',
        'src/client/lazy-app/feature-meta/**/*.ts',
        // Exclude main app components - depend on lazy loading and routing
        'src/client/initial-app/**/*.ts',
        'src/client/initial-app/**/*.tsx',
        'src/client/lazy-app/BatchProcessor/index.tsx',
        // Exclude BatchQueue processing logic - depends on WASM/workers
        'src/client/lazy-app/BatchProcessor/BatchQueue.ts',
        // Exclude utility files that depend on browser APIs/WASM
        'src/client/lazy-app/util/index.ts',
        'src/client/lazy-app/util/canvas.ts',
        'src/client/lazy-app/util/clean-modify.ts',
        'src/client/lazy-app/sw-bridge/**/*.ts',
        'src/client/lazy-app/icons/**/*.tsx',
        // Exclude style modules
        'src/**/*.css.d.ts',
        'src/**/*.css.ts',
      ],
      thresholds: {
        // Thresholds for unit-testable files
        lines: 90,
        functions: 85,
        branches: 80,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      'client': resolve(__dirname, 'src/client'),
      'shared': resolve(__dirname, 'src/shared'),
      'features': resolve(__dirname, 'src/features'),
    },
  },
});
