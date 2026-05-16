import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { BookOpen, Users, LogOut, Key, Copy, Trash2, UserMinus, Plus, LayoutGrid } from 'lucide-react';
import '../styles/Dashboards.css';

const ProfesorDashboard = () => {
    const { user, logout, theme, toggleTheme } = useAuth();
    const [alumnos, setAlumnos] = useState([]);
    const [codigos, setCodigos] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [selectedGrupo, setSelectedGrupo] = useState('');
    const [maxUsos, setMaxUsos] = useState('');

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            const [resAlumnos, resCodigos, resGrupos] = await Promise.all([
                api.get('/profesor/alumnos'),
                api.get('/profesor/codigos'),
                api.get('/profesor/grupos')
            ]);
            setAlumnos(resAlumnos.data);
            setCodigos(resCodigos.data);
            setGrupos(resGrupos.data);
            setLoading(false);
        } catch (error) {
            console.error("Error cargando datos del profesor", error);
            setLoading(false);
        }
    };

    const generarCodigo = async (e) => {
        if (e) e.preventDefault();
        try {
            await api.post('/profesor/codigo', { 
                usos_maximos: maxUsos ? parseInt(maxUsos) : null,
                id_grupo: selectedGrupo ? parseInt(selectedGrupo) : null
            });
            setShowCodeModal(false);
            setSelectedGrupo('');
            setMaxUsos('');
            cargarDatos();
        } catch (error) {
            alert("Error al generar código");
            console.error(error);
        }
    };

    const eliminarCodigo = async (id) => {
        if (!confirm("¿Estás seguro de que deseas desactivar este código?")) return;
        try {
            await api.delete(`/profesor/codigo/${id}`);
            cargarDatos();
        } catch (error) {
            alert("Error al desactivar código");
            console.error(error);
        }
    };

    const desvincularAlumno = async (id) => {
        if (!confirm("¿Estás seguro de que deseas desvincular a este alumno?")) return;
        try {
            await api.delete(`/profesor/alumnos/${id}`);
            cargarDatos();
        } catch (error) {
            alert("Error al desvincular alumno");
            console.error(error);
        }
    };

    const copiarAlPortapapeles = (texto) => {
        navigator.clipboard.writeText(texto);
        alert("Código copiado al portapapeles");
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="dashboard-header-left">
                    <BookOpen size={40} color="var(--primary-color)" />
                    <h1 style={{ fontSize: '2rem' }}>Panel del Profesor</h1>
                </div>
                <div className="dashboard-header-right">
                    <div className="user-badge">Profesor: {user?.email}</div>
                    <button onClick={toggleTheme} className="action-btn">
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button onClick={logout} className="action-btn logout-btn">
                        <LogOut size={18} /> Salir
                    </button>
                </div>
            </header>

            <div className="dashboard-grid">
                {/* Mis Grupos */}
                <div className="glass-card">
                    <div className="card-header">
                        <h2 className="card-title">
                            <LayoutGrid size={24} color="var(--primary-color)" /> Mis Grupos / Aulas
                        </h2>
                    </div>
                    {loading ? <p>Cargando...</p> : (
                        <div className="permissions-grid" style={{ gridTemplateColumns: '1fr' }}>
                            {grupos.map(g => (
                                <div key={g.id} className="perm-card" style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{g.nombre}</div>
                                        <div className="status-badge status-active">{g.integrantes?.length || 0} Alumnos</div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{g.descripcion}</div>
                                </div>
                            ))}
                            {grupos.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No tienes grupos asignados.</p>}
                        </div>
                    )}
                </div>

                {/* Códigos de Invitación */}
                <div className="glass-card">
                    <div className="card-header">
                        <h2 className="card-title">
                            <Key size={24} color="var(--primary-color)" /> Códigos de Invitación
                        </h2>
                        <button onClick={() => setShowCodeModal(true)} className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', padding: '0.5rem 1rem' }}>
                            <Plus size={18} /> Nuevo Código
                        </button>
                    </div>

                    {/* Modal Generar Código */}
                    {showCodeModal && (
                        <div className="modal-overlay">
                            <div className="modal-content">
                                <div className="card-header">
                                    <h2>Generar Código de Invitación</h2>
                                    <button onClick={() => setShowCodeModal(false)} className="action-btn"><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button>
                                </div>
                                <form onSubmit={generarCodigo}>
                                    <div className="form-group">
                                        <label className="form-label">Asociar a Grupo (Opcional)</label>
                                        <select 
                                            className="form-input" 
                                            value={selectedGrupo} 
                                            onChange={(e) => setSelectedGrupo(e.target.value)}
                                        >
                                            <option value="">Código General (Solo Profesor)</option>
                                            {grupos.map(g => (
                                                <option key={g.id} value={g.id}>{g.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Límite de Usos (Vacío para ilimitado)</label>
                                        <input 
                                            type="number" 
                                            className="form-input" 
                                            value={maxUsos} 
                                            onChange={(e) => setMaxUsos(e.target.value)}
                                            placeholder="Ej: 30"
                                        />
                                    </div>
                                    <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%', padding: '1rem', marginTop: '1rem' }}>
                                        Generar Código
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {loading ? <p>Cargando...</p> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Usos</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {codigos.map(c => (
                                        <tr key={c.id_codigo}>
                                            <td style={{ fontWeight: 'bold', letterSpacing: '1px', fontFamily: 'monospace', fontSize: '1.1rem' }}>{c.codigo}</td>
                                            <td>{c.usos_actuales} {c.usos_maximos ? `/ ${c.usos_maximos}` : ''}</td>
                                            <td>
                                                <span className={`status-badge ${c.activo ? 'status-active' : 'status-inactive'}`}>
                                                    {c.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => copiarAlPortapapeles(c.codigo)} className="action-btn copy-btn" title="Copiar">
                                                    <Copy size={16} />
                                                </button>
                                                {c.activo && (
                                                    <button onClick={() => eliminarCodigo(c.id_codigo)} className="action-btn danger" title="Desactivar">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {codigos.length === 0 && (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay códigos generados.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Alumnos */}
                <div className="glass-card">
                    <div className="card-header">
                        <h2 className="card-title">
                            <Users size={24} color="var(--primary-color)" /> Mis Alumnos
                        </h2>
                    </div>

                    {loading ? <p>Cargando...</p> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alumnos.map(a => (
                                        <tr key={a.id}>
                                            <td>{a.email}</td>
                                            <td>
                                                <span className={`status-badge ${a.activo ? 'status-active' : 'status-inactive'}`}>
                                                    {a.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>
                                                <button onClick={() => desvincularAlumno(a.id)} className="action-btn danger" title="Desvincular">
                                                    <UserMinus size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {alumnos.length === 0 && (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No tienes alumnos asignados aún.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfesorDashboard;
