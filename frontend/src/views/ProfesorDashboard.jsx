import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { BookOpen, Users, LogOut, Key, Copy, Trash2, UserMinus, Plus, LayoutGrid } from 'lucide-react';
import ContextRoleBadge from '../components/ContextRoleBadge';
import ReBACManagementModal from '../components/ReBACManagementModal';
import '../styles/Dashboards.css';

const ProfesorDashboard = () => {
    const { user, logout, theme, toggleTheme, hasPermission } = useAuth();
    const [alumnos, setAlumnos] = useState([]);
    const [codigos, setCodigos] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [selectedGrupo, setSelectedGrupo] = useState('');
    const [maxUsos, setMaxUsos] = useState('');
    const [showCreateClassModal, setShowCreateClassModal] = useState(false);
    const [newClassData, setNewClassData] = useState({ nombre: '', descripcion: '' });
    const [showManageModal, setShowManageModal] = useState(false);
    const [managingGroup, setManagingGroup] = useState(null);
    const [groupRoles, setGroupRoles] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [groupFilter, setGroupFilter] = useState('todos');
    const canManageGroups = hasPermission('GRUPOS_GESTIONAR');
    const canManageCodes = hasPermission('CODIGOS_GESTIONAR');
    const canManageStudents = hasPermission('ALUMNOS_GESTIONAR');

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            const [resAlumnos, resCodigos, resGrupos, resColegas] = await Promise.all([
                canManageStudents ? api.get('/profesor/alumnos') : Promise.resolve({ data: [] }),
                canManageCodes ? api.get('/profesor/codigos') : Promise.resolve({ data: [] }),
                canManageGroups ? api.get('/profesor/grupos') : Promise.resolve({ data: [] }),
                canManageGroups ? api.get('/profesor/colegas').catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
            ]);
            setAlumnos(resAlumnos.data);
            setCodigos(resCodigos.data);
            setGrupos(resGrupos.data);
            setAllUsers(resColegas.data);
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

    const activarCodigo = async (id) => {
        try {
            await api.patch(`/profesor/codigo/${id}/activar`);
            cargarDatos();
        } catch (error) {
            alert(error.response?.data?.error || "Error al activar codigo");
            console.error(error);
        }
    };

    const eliminarCodigoPermanente = async (id) => {
        if (!confirm("Eliminar este codigo definitivamente? Esta accion no se puede deshacer.")) return;
        try {
            await api.delete(`/profesor/codigo/${id}/permanente`);
            cargarDatos();
        } catch (error) {
            alert(error.response?.data?.error || "Error al eliminar definitivamente el codigo");
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

    const crearClase = async (e) => {
        e.preventDefault();
        try {
            await api.post('/profesor/grupos', newClassData);
            setShowCreateClassModal(false);
            setNewClassData({ nombre: '', descripcion: '' });
            cargarDatos();
        } catch (error) {
            alert(error.response?.data?.error || "Error al crear clase");
        }
    };

    const eliminarClase = async (grupo) => {
        if (!confirm(`Eliminar la clase "${grupo.nombre}"?`)) return;
        try {
            await api.delete(`/profesor/grupos/${grupo.id}`);
            cargarDatos();
        } catch (error) {
            alert(error.response?.data?.error || "Error al eliminar clase");
        }
    };

    const cargarRolesGrupo = async (grupoId) => {
        try {
            const res = await api.get(`/profesor/grupos/${grupoId}/roles`);
            setGroupRoles(res.data);
        } catch (error) {
            alert(error.response?.data?.error || "Error al cargar roles del grupo");
        }
    };

    const abrirGestionAula = (grupo) => {
        setManagingGroup(grupo);
        setShowManageModal(true);
        cargarRolesGrupo(grupo.id);
    };

    const asignarRolGrupo = async (roleData) => {
        try {
            await api.post(`/profesor/grupos/${managingGroup.id}/roles`, roleData);
            cargarRolesGrupo(managingGroup.id);
            cargarDatos();
        } catch (error) {
            alert(error.response?.data?.error || "Error al asignar rol");
        }
    };

    const revocarRolGrupo = async (relationId) => {
        if (!confirm("Revocar este rol contextual?")) return;
        try {
            await api.delete(`/profesor/grupos/${managingGroup.id}/roles/${relationId}`);
            cargarRolesGrupo(managingGroup.id);
            cargarDatos();
        } catch (error) {
            alert(error.response?.data?.error || "Error al revocar rol");
        }
    };

    const filteredGroups = grupos.filter(g => {
        if (groupFilter === 'director') return g.roles_en_grupo?.includes('director_grupo');
        if (groupFilter === 'invitado') return !g.roles_en_grupo?.includes('director_grupo');
        return true;
    });

    const getClasesAlumno = (alumno) => {
        const alumnoId = alumno.id || alumno.id_usuario;
        const clasesFromApi = alumno.clases || [];
        const clasesFromGroups = grupos
            .filter((grupo) => (grupo.integrantes || []).some((integrante) => (
                (integrante.id || integrante.id_usuario) === alumnoId || integrante.email === alumno.email
            )))
            .map((grupo) => ({ id: grupo.id || grupo.id_grupo, nombre: grupo.nombre }));

        const uniqueById = new Map();
        [...clasesFromApi, ...clasesFromGroups].forEach((clase) => {
            const key = clase.id || clase.nombre;
            if (key && !uniqueById.has(key)) uniqueById.set(key, clase);
        });

        return [...uniqueById.values()];
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
                {canManageGroups && (
                <div className="glass-card">
                    <div className="card-header">
                        <h2 className="card-title">
                            <LayoutGrid size={24} color="var(--primary-color)" /> Mis Clases / Materias
                        </h2>
                        {canManageGroups && (
                            <button onClick={() => setShowCreateClassModal(true)} className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', padding: '0.5rem 1rem' }}>
                                <Plus size={18} /> Nueva Materia
                            </button>
                        )}
                    </div>
                    <div className="segmented-filter" style={{ marginBottom: '1rem' }}>
                        <button className={groupFilter === 'todos' ? 'active' : ''} onClick={() => setGroupFilter('todos')}>Todos</button>
                        <button className={groupFilter === 'director' ? 'active' : ''} onClick={() => setGroupFilter('director')}>Director</button>
                        <button className={groupFilter === 'invitado' ? 'active' : ''} onClick={() => setGroupFilter('invitado')}>Invitado</button>
                    </div>
                    {loading ? <p>Cargando...</p> : (
                        <div className="permissions-grid" style={{ gridTemplateColumns: '1fr' }}>
                            {filteredGroups.map(g => (
                                <div key={g.id || g.id_grupo} className="perm-card" style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{g.nombre}</div>
                                        <div className="status-badge status-active">{g.integrantes?.length || 0} Alumnos</div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{g.descripcion}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                            {(g.roles_en_grupo || []).map((rol, index) => (
                                                <ContextRoleBadge key={`${g.id || g.id_grupo}-${rol}-${index}`} role={rol} />
                                            ))}
                                        </div>
                                        {canManageGroups && g.roles_en_grupo?.includes('director_grupo') && (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => abrirGestionAula(g)} className="action-btn" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}>
                                                    Gestionar Aula
                                                </button>
                                                <button onClick={() => eliminarClase(g)} className="action-btn danger" title="Eliminar clase" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}>
                                                    <Trash2 size={14} /> Eliminar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {filteredGroups.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay clases/materias para este filtro.</p>}
                        </div>
                    )}
                </div>

                )}
                {/* Códigos de Invitación */}
                {canManageCodes && (
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
                                        <label className="form-label">Asociar a Clase/Materia (Opcional)</label>
                                        <select 
                                            className="form-input" 
                                            value={selectedGrupo} 
                                            onChange={(e) => setSelectedGrupo(e.target.value)}
                                        >
                                            <option value="">Código General (Solo Profesor)</option>
                                            {grupos.map(g => (
                                                <option key={g.id || g.id_grupo} value={g.id || g.id_grupo}>{g.nombre}</option>
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
                                        <th>Clase / Destino</th>
                                        <th>Usos</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {codigos.map(c => (
                                        <tr key={c.id_codigo || c.id || c.codigo}>
                                            <td style={{ fontWeight: 'bold', letterSpacing: '1px', fontFamily: 'monospace', fontSize: '1.1rem' }}>{c.codigo}</td>
                                            <td>
                                                {c.grupo ? (
                                                    <span className="status-badge" style={{ background: 'rgba(59, 130, 246, 0.16)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.35)' }}>
                                                        {c.grupo.nombre}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>General (Sin Grupo)</span>
                                                )}
                                            </td>
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
                                                {c.activo ? (
                                                    <button onClick={() => eliminarCodigo(c.id_codigo)} className="action-btn danger" title="Desactivar">
                                                        Desactivar
                                                    </button>
                                                ) : (
                                                    <button onClick={() => activarCodigo(c.id_codigo)} className="action-btn" title="Activar">
                                                        Activar
                                                    </button>
                                                )}
                                                <button onClick={() => eliminarCodigoPermanente(c.id_codigo)} className="action-btn danger" title="Eliminar definitivamente">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {codigos.length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay códigos generados.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                )}

                {/* Alumnos */}
                {canManageStudents && (
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
                                        <th>Clase asociada</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alumnos.map(a => (
                                        <tr key={a.id || a.id_usuario || a.email}>
                                            <td>{a.email}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                    {getClasesAlumno(a).length > 0 ? (
                                                        getClasesAlumno(a).map((clase) => (
                                                            <span key={`${a.id || a.id_usuario}-${clase.id}`} className="status-badge" style={{ background: 'rgba(59, 130, 246, 0.16)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.35)' }}>
                                                                {clase.nombre}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>Sin clase asociada</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${a.activo ? 'status-active' : 'status-inactive'}`}>
                                                    {a.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>
                                                <button onClick={() => desvincularAlumno(a.id || a.id_usuario)} className="action-btn danger" title="Desvincular">
                                                    <UserMinus size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {alumnos.length === 0 && (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No tienes alumnos asignados aún.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                )}

                {canManageGroups && showCreateClassModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="card-header">
                                <h2>Crear Nueva Clase/Materia</h2>
                                <button onClick={() => setShowCreateClassModal(false)} className="action-btn"><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button>
                            </div>
                            <form onSubmit={crearClase}>
                                <div className="form-group">
                                    <label className="form-label">Nombre de la clase/materia</label>
                                    <input className="form-input" required placeholder="Ej: Matemáticas - 10A" value={newClassData.nombre} onChange={e => setNewClassData({ ...newClassData, nombre: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">DescripciÃ³n</label>
                                    <input className="form-input" placeholder="Ej: Álgebra, grupo 10A, periodo 2026" value={newClassData.descripcion} onChange={e => setNewClassData({ ...newClassData, descripcion: e.target.value })} />
                                </div>
                                <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%', padding: '1rem' }}>
                                    Crear clase/materia
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {showManageModal && managingGroup && (
                    <ReBACManagementModal
                        title={`Gestionar materia: ${managingGroup.nombre}`}
                        roles={groupRoles}
                        users={allUsers}
                        onClose={() => setShowManageModal(false)}
                        onAssign={asignarRolGrupo}
                        onRevoke={revocarRolGrupo}
                        assignableRoles={['director_grupo', 'profesor_materia', 'tutor_asistente']}
                    />
                )}
            </div>
        </div>
    );
};

export default ProfesorDashboard;
