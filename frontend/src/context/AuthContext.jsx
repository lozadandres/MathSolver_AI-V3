import { createContext, useState, useEffect, useContext, useRef } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [theme, setTheme] = useState('dark');
    const hydrationStarted = useRef(false);

    useEffect(() => {
        const hydrateUser = async () => {
        if (hydrationStarted.current) return;
        hydrationStarted.current = true;

        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('accessToken');
        
        if (storedUser && token) {
            const parsedUser = JSON.parse(storedUser);
            let currentUser = parsedUser;

            try {
                let response;
                try {
                    response = await api.post('/auth/refresh');
                    if (response.data.accessToken) {
                        localStorage.setItem('accessToken', response.data.accessToken);
                    }
                } catch (error) {
                    if (error.response?.status === 401) {
                        response = await api.get('/auth/me');
                    } else {
                        throw error;
                    }
                }

                currentUser = response.data.user || currentUser;
                localStorage.setItem('user', JSON.stringify(currentUser));
            } catch (error) {
                console.error('No se pudo refrescar el usuario actual', error);
            }

            setUser(currentUser);
            
            const userTheme = currentUser.configuracion?.tema || 'dark';
            setTheme(userTheme);
            document.documentElement.setAttribute('data-theme', userTheme);
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        setIsLoading(false);
        };

        hydrateUser();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { accessToken, user: userData } = response.data;
            
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('user', JSON.stringify(userData));
            
            setUser(userData);
            
            const userTheme = userData.configuracion?.tema || 'dark';
            setTheme(userTheme);
            document.documentElement.setAttribute('data-theme', userTheme);
            
            return { success: true, user: userData };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || 'Error de conexión'
            };
        }
    };

    const register = async (email, password, rol_nombre) => {
        try {
            const response = await api.post('/auth/register', { email, password, rol_nombre });
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || 'Error de conexión al registrarse'
            };
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            console.error('Logout error', e);
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            setUser(null);
        }
    };

    const toggleTheme = async () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        await updateConfiguration({ tema: newTheme });
    };

    const updateConfiguration = async (changes) => {
        const nextConfig = {
            ...(user?.configuracion || {}),
            ...changes
        };

        if (changes.tema) {
            setTheme(changes.tema);
            document.documentElement.setAttribute('data-theme', changes.tema);
        }

        if (user) {
            const updatedUser = { ...user, configuracion: nextConfig };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            try {
                const response = await api.put('/auth/configuracion', changes);
                const savedConfig = response.data.configuracion || nextConfig;
                const syncedUser = response.data.user || { ...updatedUser, configuracion: savedConfig };
                setUser(syncedUser);
                localStorage.setItem('user', JSON.stringify(syncedUser));
                return { success: true, configuracion: savedConfig };
            } catch (e) {
                console.error("No se pudo sincronizar la configuracion con la base de datos", e);
                return {
                    success: false,
                    error: e.response?.data?.error || 'No se pudo guardar la configuracion'
                };
            }
        }

        return { success: true, configuracion: nextConfig };
    };

    const hasPermission = (permission) => {
        if (!permission || !user) return false;
        if (user.role === 'Admin') return true;

        return (user.permissions || []).some((ownedPermission) => {
            if (ownedPermission === '*' || ownedPermission === permission) return true;

            const ownedParts = ownedPermission.split(':');
            const requiredParts = permission.split(':');
            return ownedParts.every((part, index) => part === '*' || part === requiredParts[index]);
        });
    };

    return (
        <AuthContext.Provider value={{ user, setUser, isAuthenticated: !!user, isLoading, login, logout, register, theme, setTheme, toggleTheme, updateConfiguration, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};
