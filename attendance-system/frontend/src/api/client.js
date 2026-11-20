import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Expired/invalid token -> clear session and go to login (except on the login call itself)
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const errorMessage = (e) => e.response?.data?.message || (e.request ? 'Cannot reach the server. Is the backend running?' : 'Something went wrong');
// Maps express-validator errors [{field, message}] to {field: message}
export const fieldErrors = (e) => Object.fromEntries((e.response?.data?.errors || []).map((x) => [x.field, x.message]));

export default api;
