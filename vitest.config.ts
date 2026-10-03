import { defineConfig } from 'vitest/config';

// Unit tests run in Node, independently of the Worker runtime or credentials.
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } });
