import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const isPublicAuthRoute = (url = '') => (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
);

const api = axios.create({
    baseURL,
    withCredentials: true, // Importante para enviar cookies de Refresh Token
    headers: {
        'Content-Type': 'application/json',
    }
});

let refreshPromise = null;

const refreshSession = async () => {
    if (!refreshPromise) {
        refreshPromise = axios
            .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

const getJwtPayload = (token) => {
    try {
        const [, payload] = token.split('.');
        if (!payload) return null;
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
};

const tokenExpiresSoon = (token) => {
    const payload = getJwtPayload(token);
    if (!payload?.exp) return false;
    const expiresAt = payload.exp * 1000;
    return expiresAt - Date.now() < 30_000;
};

// Interceptor de Peticiones: Inyecta el Access Token si existe
api.interceptors.request.use(
    async (config) => {
        config.headers = config.headers || {};
        let token = localStorage.getItem('accessToken');

        if (token && !isPublicAuthRoute(config.url) && tokenExpiresSoon(token)) {
            try {
                const response = await refreshSession();
                token = response.data.accessToken;
                localStorage.setItem('accessToken', token);
                if (response.data.user) {
                    localStorage.setItem('user', JSON.stringify(response.data.user));
                }
            } catch (refreshError) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
                const currentPath = window.location.pathname;
                if (currentPath !== '/login' && currentPath !== '/register') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
            delete config.headers['content-type'];
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor de Respuestas: Maneja expiración silenciosa de token (Refresh)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isPublicAuthRoute(originalRequest.url)) {
            originalRequest._retry = true;

            try {
                // Llamada de background al Refresh Token
                const response = await refreshSession();
                const { accessToken, user } = response.data;
                
                localStorage.setItem('accessToken', accessToken);
                if (user) {
                    localStorage.setItem('user', JSON.stringify(user));
                }
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                
                return api(originalRequest);
                
            } catch (refreshError) {
                // Si el refresh falla, expulsar al usuario
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
                const currentPath = window.location.pathname;
                if (currentPath !== '/login' && currentPath !== '/register') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
