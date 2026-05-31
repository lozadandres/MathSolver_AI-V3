import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { GraduationCap, Users, LogOut, Plus, LayoutGrid, BookOpen, Settings, FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SettingsModal from '../components/SettingsModal';
import ProfileAvatar from '../components/ProfileAvatar';
import TablePagination from '../components/TablePagination';
import usePagination from '../hooks/usePagination';
import useTableSort from '../hooks/useTableSort';
import '../styles/Dashboards.css';

const EstudianteDashboard = () => {
    const { user, logout, theme, toggleTheme, hasPermission } = useAuth();
    const navigate = useNavigate();
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [materialsGroup, setMaterialsGroup] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [materialsLoading, setMaterialsLoading] = useState(false);
    const canJoinClasses = hasPermission('CLASES_UNIRSE');
    const canViewClasses = hasPermission('CLASES_VER');
    const canUseChat = hasPermission('CHAT_IA');
    const gruposSort = useTableSort(grupos, 'nombre', 'asc', {
        nombre: (item) => item.nombre,
        profesor: (item) => item.profesor?.email,
        descripcion: (item) => item.descripcion
    });
    const materialesSort = useTableSort(materials, 'titulo', 'asc', {
        titulo: (item) => item.titulo,
        tipo: (item) => item.tipo,
        profesor: (item) => item.creador?.email
    });
    const gruposPagination = usePagination(gruposSort.sortedItems, 5, `${gruposSort.sortKey}-${gruposSort.direction}`);
    const materialesPagination = usePagination(materialesSort.sortedItems, 5, `${materialsGroup?.id || ''}-${materialesSort.sortKey}-${materialesSort.direction}`);

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

    const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
    const resolveFileUrl = (url) => {
        if (!url) return null;
        if (/^https?:\/\//i.test(url)) return url;
        return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`;
    };

    const getProfesorGrupo = (grupo) => {
        const contextualTeacher = (grupo.roles_contextuales || []).find(role => role.relacion === 'director_grupo')
            || (grupo.roles_contextuales || []).find(role => role.relacion === 'tutor_asistente')
            || (grupo.roles_contextuales || []).find(role => role.relacion === 'profesor_materia');

        return grupo.profesor?.email || contextualTeacher?.email || 'N/A';
    };

    const abrirMateriales = async (grupo) => {
        setMaterialsGroup(grupo);
        setMaterialsLoading(true);
        try {
            const res = await api.get(`/grupos/${grupo.id}/documentos`);
            setMaterials(res.data);
        } catch (error) {
            alert(error.response?.data?.error || 'Error al cargar materiales');
        } finally {
            setMaterialsLoading(false);
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
                    <ProfileAvatar user={user} size={42} />
                    <div className="user-badge">Estudiante: {user?.email}</div>
                    <button onClick={toggleTheme} className="action-btn">
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button onClick={() => setShowSettings(true)} className="action-btn">
                        <Settings size={18} /> Ajustes
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
                        <div className="permissions-grid student-class-grid">
                            {gruposPagination.pageItems.map(g => (
                                <div key={g.id} className="perm-card student-class-card">
                                    <div className="student-class-card-header">
                                        <div className="student-class-title">{g.nombre}</div>
                                        <BookOpen size={20} color="var(--primary-color)" />
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{g.descripcion || 'Sin descripción'}</div>
                                    <div className="student-class-footer">
                                        <div className="student-class-teacher"><strong>Profesor:</strong> {getProfesorGrupo(g)}</div>
                                        <div className="student-class-actions">
                                            <button
                                                onClick={() => abrirMateriales(g)}
                                                className="action-btn"
                                            >
                                                <FileText size={14} /> Material
                                            </button>
                                            {canUseChat && (
                                                <button
                                                    onClick={() => navigate(`/chat/${g.id}`)}
                                                    className="action-btn"
                                                    style={{ background: 'var(--primary-color)', color: 'white' }}
                                                >
                                                    Entrar al Chat
                                                </button>
                                            )}
                                        </div>
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
                            <TablePagination pagination={gruposPagination} />
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

            {materialsGroup && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: 820 }}>
                        <div className="card-header">
                            <h2>Material de clase: {materialsGroup.nombre}</h2>
                            <button onClick={() => setMaterialsGroup(null)} className="action-btn">
                                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>

                        {materialsLoading ? <p>Cargando materiales...</p> : (
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {materialesPagination.pageItems.map(doc => (
                                    <div key={doc.id} className="perm-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                                            <div>
                                                <strong>{doc.titulo}</strong>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{doc.descripcion || 'Sin descripcion'}</div>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                                    <span className="status-badge">{doc.tipo}</span>
                                                    {doc.creador?.email && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Publicado por {doc.creador.email}</span>}
                                                </div>
                                            </div>
                                            <div>
                                                {doc.archivo_url && (
                                                    <a className="action-btn" href={resolveFileUrl(doc.archivo_url)} target="_blank" rel="noreferrer">
                                                        <ExternalLink size={16} /> Abrir
                                                    </a>
                                                )}
                                                {doc.tipo === 'enlace' && doc.contenido && (
                                                    <a className="action-btn" href={doc.contenido} target="_blank" rel="noreferrer">
                                                        <ExternalLink size={16} /> Abrir
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        {(doc.tipo === 'texto' || doc.tipo === 'tarea') && doc.contenido && (
                                            <p style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', marginBottom: 0 }}>{doc.contenido}</p>
                                        )}
                                    </div>
                                ))}
                                {materials.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        <FileText size={40} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
                                        <p>Esta clase aun no tiene materiales visibles.</p>
                                    </div>
                                )}
                                <TablePagination pagination={materialesPagination} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default EstudianteDashboard;
