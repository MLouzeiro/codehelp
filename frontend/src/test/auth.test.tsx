import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useContext, createContext } from 'react';
import { AuthProvider, useAuth } from '../services/auth';

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

import api from '../services/api';

const TestComponent = () => {
  const { user, loading, error, login } = useAuth();
  if (loading) return <div>loading...</div>;
  return (
    <div>
      <span data-testid="user">{user ? `${user.name} (${user.role})` : 'null'}</span>
      <span data-testid="error">{error || 'null'}</span>
      <button data-testid="login-btn" onClick={() => login('admin@codemed.com.br', 'admin123')}>login</button>
      <button data-testid="login-fail-btn" onClick={() => login('x@x.com', 'wrong').catch(() => {})}>login fail</button>
    </div>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (name) document.cookie = `${name}=; path=/; max-age=0`;
    });
    vi.clearAllMocks();
  });

  it('login com credenciais válidas seta user com role admin', async () => {
    const mockPost = vi.mocked(api.post);
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: 'abc',
        refreshToken: 'def',
        user: { id: '1', name: 'Admin', email: 'admin@codemed.com.br', role: 'admin' },
      },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('user').textContent).toBe('null');

    screen.getByTestId('login-btn').click();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Admin (admin)');
    });

    expect(document.cookie).toContain('accessToken=abc');
    expect(document.cookie).toContain('refreshToken=def');
  });

  it('login com credenciais inválidas retorna error sem setar user', async () => {
    const mockPost = vi.mocked(api.post);
    mockPost.mockRejectedValueOnce({
      response: { data: { error: 'Credenciais inválidas' } },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    screen.getByTestId('login-fail-btn').click();

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).not.toBe('null');
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(document.cookie).not.toContain('accessToken=');
  });
});
