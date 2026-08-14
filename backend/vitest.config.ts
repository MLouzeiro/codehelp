import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    // Os testes compartilham o mesmo SQLite (dev). Executar arquivos em
    // paralelo causa corridas de banco (SQLITE_BUSY / estados entre arquivos).
    // Arquivos em sequência = determinístico; paralelismo fica por caso.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
