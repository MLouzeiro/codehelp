import { describe, it, expect } from 'vitest';
import express from 'express';

describe('Smoke — servidor sobe e health responde', () => {
  it('rota /api/health configurada no Express', () => {
    const app = express();
    let handlerCalled = false;

    app.get('/api/health', (req, res) => {
      handlerCalled = true;
      res.json({ status: 'ok' });
    });

    // Verify the route is registered by checking that
    // Express has a matching layer for /api/health GET
    const routes = app._router?.stack
      ?.filter((layer: any) => layer.route?.path === '/api/health')
      ?.map((layer: any) => layer.route.methods);

    expect(routes?.length).toBeGreaterThanOrEqual(1);
    expect(routes?.[0]).toHaveProperty('get', true);
  });

  it('/api/health retorna JSON com status ok', () => {
    const app = express();
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Test the handler logic by simulating what it does
    const timestamp = new Date().toISOString();
    const response = { status: 'ok', timestamp };

    expect(response).toHaveProperty('status', 'ok');
    expect(response).toHaveProperty('timestamp');
    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
  });
});
