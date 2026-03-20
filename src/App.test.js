import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

jest.mock('axios', () => {
  const mockInstance = {
    defaults: {},
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };

  return {
    __esModule: true,
    default: {
      ...mockInstance,
      create: jest.fn(() => mockInstance),
    },
  };
});

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
  Toaster: () => null,
}));

beforeEach(() => {
  window.localStorage.clear();
});

test('renders the login screen for unauthenticated users', async () => {
  render(<App />);

  expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  expect(screen.getAllByText(/student analytics/i)[0]).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
});
