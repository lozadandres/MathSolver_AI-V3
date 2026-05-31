import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { User, Lock, Settings, Moon, Sun, Monitor, Languages, X, Camera } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';
import '../styles/Dashboards.css';

const SettingsModal = ({ onClose }) => {
    const { user, setUser, theme, updateConfiguration, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('perfil');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [avatarLoading, setAvatarLoading] = useState(false);
    const idioma = user?.configuracion?.idioma || 'es';

    // Security Form
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (passwords.newPassword !== passwords.confirmPassword) {
            setError('Las contraseñas nuevas no coinciden');
            return;
        }

        setLoading(true);
        try {
            await api.put('/auth/password', {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            });
            setMessage('Contraseña actualizada exitosamente');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => {
                logout();
            }, 1200);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al actualizar contraseña');
        } finally {
            setLoading(false);
        }
    };

    const handlePreferenceChange = async (type, value) => {
        try {
            const result = await updateConfiguration({ [type]: value });
            if (!result.success) {
                setError(result.error || 'Error al guardar preferencia');
                setTimeout(() => setError(''), 2000);
                return;
            }
            setMessage('Preferencias guardadas');
            setTimeout(() => setMessage(''), 2000);
        } catch {
            setError('Error al guardar preferencia');
            setTimeout(() => setError(''), 2000);
        }
    };

    const handleAvatarUpload = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setMessage('');
        setError('');

        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError('Solo puedes subir imagenes JPG, PNG o WEBP');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setError('La imagen no puede superar 2 MB');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        setAvatarLoading(true);
        try {
            const response = await api.post('/auth/avatar', formData);
            if (response.data.user) {
                setUser(response.data.user);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }
            setMessage('Foto de perfil actualizada');
            setTimeout(() => {
                setMessage('');
                onClose();
            }, 700);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al subir la foto de perfil');
        } finally {
            setAvatarLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 className="dashboard-title" style={{ margin: 0, fontSize: '1.5rem' }}>Ajustes de Cuenta</h2>
                    <button onClick={onClose} className="action-btn" style={{ border: 'none' }}>
                        <X size={20} />
                    </button>
                </div>

                <div className="tabs-container" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <button 
                        className={`tab-item ${activeTab === 'perfil' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('perfil'); setMessage(''); setError(''); }}
                    >
                        <User size={18} /> Perfil
                    </button>
                    <button 
                        className={`tab-item ${activeTab === 'seguridad' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('seguridad'); setMessage(''); setError(''); }}
                    >
                        <Lock size={18} /> Seguridad
                    </button>
                    <button 
                        className={`tab-item ${activeTab === 'preferencias' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('preferencias'); setMessage(''); setError(''); }}
                    >
                        <Settings size={18} /> Preferencias
                    </button>
                </div>

                {message && <div style={{ padding: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(34, 197, 94, 0.2)' }}>{message}</div>}
                {error && <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}

                {activeTab === 'perfil' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ padding: '1.5rem', background: 'var(--input-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <ProfileAvatar user={user} size={72} />
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>{user?.email}</h3>
                                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)' }}>Rol: {user?.role}</p>
                            </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                            <div className="avatar-upload-row">
                                <ProfileAvatar user={user} size={52} />
                                <div style={{ flex: 1, minWidth: 180 }}>
                                    <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 700 }}>Foto de perfil</p>
                                    <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>JPG, PNG o WEBP. Maximo 2 MB.</p>
                                </div>
                                <label className="action-btn" style={{ cursor: avatarLoading ? 'not-allowed' : 'pointer', opacity: avatarLoading ? 0.7 : 1 }}>
                                    <Camera size={16} /> {avatarLoading ? 'Subiendo...' : 'Cambiar foto'}
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleAvatarUpload}
                                        disabled={avatarLoading}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Estado de la cuenta: <span style={{ color: '#22c55e', fontWeight: '500' }}>Activa</span></p>
                        </div>
                    </div>
                )}

                {activeTab === 'seguridad' && (
                    <form onSubmit={handlePasswordChange}>
                        <div className="form-group">
                            <label className="form-label">Contraseña Actual</label>
                            <input 
                                type="password" 
                                className="form-input" 
                                required
                                value={passwords.currentPassword}
                                onChange={e => setPasswords({...passwords, currentPassword: e.target.value})}
                                placeholder="Ingresa tu contraseña actual"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Nueva Contraseña</label>
                            <input 
                                type="password" 
                                className="form-input" 
                                required
                                minLength={6}
                                value={passwords.newPassword}
                                onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                                placeholder="Ingresa tu nueva contraseña"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirmar Nueva Contraseña</label>
                            <input 
                                type="password" 
                                className="form-input" 
                                required
                                value={passwords.confirmPassword}
                                onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})}
                                placeholder="Repite tu nueva contraseña"
                            />
                        </div>
                        <button type="submit" className="login-btn" disabled={loading} style={{ width: '100%' }}>
                            {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                        </button>
                    </form>
                )}

                {activeTab === 'preferencias' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Monitor size={18}/> Apariencia
                            </h4>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button 
                                    className={`tab-item ${theme === 'light' ? 'active' : ''}`}
                                    onClick={() => handlePreferenceChange('tema', 'light')}
                                    style={{ flex: 1, justifyContent: 'center' }}
                                >
                                    <Sun size={18}/> Claro
                                </button>
                                <button 
                                    className={`tab-item ${theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => handlePreferenceChange('tema', 'dark')}
                                    style={{ flex: 1, justifyContent: 'center' }}
                                >
                                    <Moon size={18}/> Oscuro
                                </button>
                            </div>
                        </div>

                        <div>
                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Languages size={18}/> Idioma
                            </h4>
                            <select 
                                className="form-select"
                                onChange={(e) => handlePreferenceChange('idioma', e.target.value)}
                                value={idioma}
                            >
                                <option value="es">Español (ES)</option>
                                <option value="en">English (US)</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsModal;
