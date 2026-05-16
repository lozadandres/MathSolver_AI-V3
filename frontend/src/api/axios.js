import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL,
    withCredentials: true, // Importante para enviar cookies de Refresh Token
    headers: {
        'Content-Type': 'application/json',
    }
});

// Interceptor de Peticiones: Inyecta el Access Token si existe
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
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

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Llamada de background al Refresh Token
                const response = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
                const { accessToken } = response.data;
                
                localStorage.setItem('accessToken', accessToken);
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                
                return api(originalRequest);
                
            } catch (refreshError) {
                // Si el refresh falla, expulsar al usuario
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
