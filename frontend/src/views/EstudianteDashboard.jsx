import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { GraduationCap, Users, LogOut, Key, Plus, LayoutGrid, MessageSquare, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboards.css';

const EstudianteDashboard = () => {
    const { user, logout, theme, toggleTheme, hasPermission } = useAuth();
    const navigate = useNavigate();
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const canJoinClasses = hasPermission('CLASES_UNIRSE');
    const canViewClasses = hasPermission('CLASES_VER');
    const canUseChat = hasPermission('CHAT_IA');

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            if (!canViewClasses) {
                setGrupos([]);
                setLoading(false);
                return;
            }
            const res = await api.get('/estudiante/grupos');
            setGrupos(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Error cargando datos del estudiante", error);
            setLoading(false);
        }
    };

    const unirseAClase = async (e) => {
        e.preventDefault();
        try {
            await api.post('/estudiante/unirse', { codigo: joinCode });
            setShowJoinModal(false);
            setJoinCode('');
            cargarDatos();
            alert("¡Te has unido a la clase con éxito!");
        } catch (error) {
            alert(error.response?.data?.error || "Error al unirse");
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="dashboard-header-left">
                    <GraduationCap size={40} color="var(--primary-color)" />
                    <h1 style={{ fontSize: '2rem' }}>Mi Panel de Aprendizaje</h1>
                </div>
                <div className="dashboard-header-right">
                    <div className="user-badge">Estudiante: {user?.email}</div>
                    <button onClick={toggleTheme} className="action-btn">
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button onClick={logout} className="action-btn logout-btn">
                        <LogOut size={18} /> Salir
                    </button>
                </div>
            </header>

            <div className="dashboard-grid">
                {/* Mis Grupos / Clases */}
                <div className="glass-card" style={{ gridColumn: 'span 2' }}>
                    <div className="card-header">
                        <h2 className="card-title">
                            <LayoutGrid size={24} color="var(--primary-color)" /> Mis Clases y Grupos
                        </h2>
                        {canJoinClasses && (
                            <button onClick={() => setShowJoinModal(true)} className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', padding: '0.5rem 1.5rem' }}>
                                <Plus size={18} /> Unirse a Clase
                            </button>
                        )}
                    </div>

                    {loading ? <p>Cargando tus clases...</p> : (
                        <div className="permissions-grid">
                            {grupos.map(g => (
                                <div key={g.id} className="perm-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-main)' }}>{g.nombre}</div>
                                        <BookOpen size={20} color="var(--primary-color)" />
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{g.descripcion || 'Sin descripción'}</div>
                                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div><strong>Profesor:</strong> {g.profesor?.email || 'N/A'}</div>
                                        {canUseChat && (
                                            <button
                                                onClick={() => navigate(`/chat/${g.id}`)}
                                                className="action-btn"
                                                style={{ background: 'var(--primary-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                                            >
                                                Entrar al Chat
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {grupos.length === 0 && (
                                <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                    <p>Aún no estás inscrito en ningún grupo.</p>
                                    <p style={{ fontSize: '0.8rem' }}>Pídele a tu profesor un código de invitación.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Widget de Progreso (Placeholder premium) */}
                <div className="glass-card">
                    <div className="card-header">
                        <h2 className="card-title">🚀 Mi Progreso</h2>
                    </div>
                    <div style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                            0%
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Próximamente: Estadísticas de tus problemas resueltos.</p>
                    </div>
                </div>
            </div>

            {/* Modal Unirse a Clase */}
            {canJoinClasses && showJoinModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="card-header">
                            <h2>Ingresar Código</h2>
                            <button onClick={() => setShowJoinModal(false)} className="action-btn"><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button>
                        </div>
                        <form onSubmit={unirseAClase}>
                            <div className="form-group">
                                <label className="form-label">Código de Invitación</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Ej: A1B2C3D4" 
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    required
                                    style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '1.2rem', fontWeight: 'bold' }}
                                />
                            </div>
                            <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%', padding: '1rem' }}>
                                Validar y Unirse
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EstudianteDashboard;
