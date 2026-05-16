import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Users, Shield, LogOut, Trash2, UserPlus, X, LayoutGrid, Key, Plus } from 'lucide-react';
import '../styles/Dashboards.css';

const AdminDashboard = () => {
    const { user, logout, theme, toggleTheme } = useAuth();
    const [activeTab, setActiveTab] = useState('usuarios');
    const [loading, setLoading] = useState(true);

    // Estados para Usuarios
    const [usuarios, setUsuarios] = useState([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userData, setUserData] = useState({ email: '', password: '', id_rol: '' });
    const [assignmentData, setAssignmentData] = useState({ id_profesor: '', id_estudiante: '' });

    // Estados para Grupos
    const [grupos, setGrupos] = useState([]);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [newGroup, setNewGroup] = useState({ nombre: '', descripcion: '', id_profesor: '' });

    // Estados para Roles y Permisos
    const [roles, setRoles] = useState([]);
    const [permisos, setPermisos] = useState([]);
    const [tipoRoles, setTipoRoles] = useState([]);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [newRole, setNewRole] = useState({ nombre: '', descripcion: '', permisosIds: [] });
    const [showEditRoleModal, setShowEditRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [editRoleData, setEditRoleData] = useState({ nombre: '', descripcion: '', id_tipo_rol: '' });

    useEffect(() => {
        cargarTodo();
    }, []);

    const cargarTodo = async () => {
        setLoading(true);
        try {
            const [resUsers, resGroups, resRoles, resPerms, resTipoRoles] = await Promise.all([
                api.get('/admin/usuarios'),
                api.get('/admin/grupos'),
                api.get('/admin/roles'),
                api.get('/admin/permisos'),
                api.get('/admin/tipo-roles')
            ]);
            setUsuarios(resUsers.data);
            setGrupos(resGroups.data);
            setRoles(resRoles.data);
            setPermisos(resPerms.data);
            setTipoRoles(resTipoRoles.data);
        } catch (error) {
            console.error("Error cargando datos", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Acciones de Usuarios ---
    const toggleBloqueo = async (id, actual) => {
        try {
            await api.put(`/admin/usuarios/${id}/bloquear`, { bloqueado: !actual });
            cargarTodo();
        } catch (error) { console.error(error); }
    };

    const cambiarRol = async (id, id_rol) => {
        try {
            await api.put(`/admin/usuarios/${id}/rol`, { id_rol });
            cargarTodo();
        } catch (error) { console.error(error); }
    };

    const eliminarUsuario = async (id) => {
        if (!confirm("¿Eliminar permanentemente?")) return;
        try {
            await api.delete(`/admin/usuarios/${id}`);
            cargarTodo();
        } catch (error) { console.error(error); }
    };

    const manejarUsuario = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await api.put(`/admin/usuarios/${editingUser.id}`, userData);
            } else {
                await api.post('/admin/usuarios', userData);
            }
            setShowUserModal(false);
            setEditingUser(null);
            setUserData({ email: '', password: '', id_rol: '' });
            cargarTodo();
        } catch (error) { alert(error.response?.data?.error || 'Error al procesar usuario'); }
    };

    const abrirEdicion = (u) => {
        setEditingUser(u);
        setUserData({ email: u.email, password: '', id_rol: u.roleId || '' });
        setShowUserModal(true);
    };

    const manejarAsignacion = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/asignar', assignmentData);
            setShowAssignModal(false);
            cargarTodo();
        } catch (error) { alert(error.response?.data?.error); }
    };

    // --- Acciones de Grupos ---
    const crearGrupo = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/grupos', newGroup);
            setShowGroupModal(false);
            setNewGroup({ nombre: '', descripcion: '', id_profesor: '' });
            cargarTodo();
        } catch (error) { console.error(error); }
    };

    // --- Acciones de Permisos ---
    // --- Acciones de Roles ---
    const crearRol = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/roles', newRole);
            setShowRoleModal(false);
            setNewRole({ nombre: '', descripcion: '', permisosIds: [] });
            cargarTodo();
        } catch (error) { alert(error.response?.data?.error || 'Error al crear rol'); }
    };

    const abrirEdicionRol = (r) => {
        setEditingRole(r);
        setEditRoleData({ nombre: r.nombre, descripcion: r.descripcion || '', id_tipo_rol: '' });
        setShowEditRoleModal(true);
    };

    const guardarEdicionRol = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/admin/roles/${editingRole.id}`, editRoleData);
            setShowEditRoleModal(false);
            setEditingRole(null);
            cargarTodo();
        } catch (error) { alert(error.response?.data?.error || 'Error al editar rol'); }
    };

    const eliminarRol = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este rol?')) return;
        try {
            await api.delete(`/admin/roles/${id}`);
            cargarTodo();
        } catch (error) { alert(error.response?.data?.error || 'Error al eliminar rol'); }
    };

    const togglePermiso = async (id_rol, id_permiso, tiene) => {
        try {
            if (tiene) {
                await api.delete(`/admin/roles/${id_rol}/permisos/${id_permiso}`);
            } else {
                await api.post(`/admin/roles/${id_rol}/permisos`, { id_permiso });
            }
            cargarTodo();
        } catch (error) { console.error(error); }
    };

    const profesores = usuarios.filter(u => u.role === 'Profesor');
    const estudiantes = usuarios.filter(u => u.role === 'Estudiante');

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="dashboard-header-left">
                    <Shield size={40} color="var(--primary-color)" />
                    <h1 style={{ fontSize: '2rem' }}>Panel de Administración</h1>
                </div>
                <div className="dashboard-header-right">
                    <div className="user-badge">Admin: {user?.email}</div>
                    <button onClick={toggleTheme} className="action-btn">
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button onClick={logout} className="action-btn logout-btn">
                        <LogOut size={18} /> Salir
                    </button>
                </div>
            </header>

            <nav className="tabs-container">
                <div className={`tab-item ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>
                    <Users size={18} /> Usuarios
                </div>
                <div className={`tab-item ${activeTab === 'grupos' ? 'active' : ''}`} onClick={() => setActiveTab('grupos')}>
                    <LayoutGrid size={18} /> Grupos
                </div>
                <div className={`tab-item ${activeTab === 'permisos' ? 'active' : ''}`} onClick={() => setActiveTab('permisos')}>
                    <Key size={18} /> Roles y Permisos
                </div>
            </nav>

            {loading ? <p>Cargando panel...</p> : (
                <>
                    {/* SECCIÓN USUARIOS */}
                    {activeTab === 'usuarios' && (
                        <div className="glass-card">
                            <div className="card-header">
                                <h2 className="card-title"><Users size={24} color="var(--primary-color)" /> Usuarios</h2>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => { setEditingUser(null); setUserData({ email: '', password: '', id_rol: '' }); setShowUserModal(true); }} className="action-btn" style={{ background: 'var(--primary-color)', color: 'white' }}>
                                        <Plus size={18} /> Nuevo Usuario
                                    </button>
                                    <button onClick={() => setShowAssignModal(true)} className="action-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}>
                                        <UserPlus size={18} /> Asignar Alumno
                                    </button>
                                </div>
                            </div>
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>Rol</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usuarios.map(u => (
                                        <tr key={u.id}>
                                            <td style={{ fontWeight: '500' }}>{u.email}</td>
                                            <td>
                                                <select 
                                                    value={u.roleId || ''} 
                                                    onChange={(e) => cambiarRol(u.id, parseInt(e.target.value))}
                                                    className="form-select" style={{width: 'auto', fontSize: '0.8rem'}}
                                                >
                                                    {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                                </select>
                                            </td>
                                            <td><span className={`status-badge ${u.bloqueado ? 'status-inactive' : 'status-active'}`}>{u.bloqueado ? 'Bloqueado' : 'Activo'}</span></td>
                                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                {u.role !== 'Admin' && (
                                                    <button onClick={() => toggleBloqueo(u.id, u.bloqueado)} className="action-btn" style={{color: u.bloqueado ? '#10b981' : '#ef4444', fontSize: '0.75rem'}}>
                                                        {u.bloqueado ? 'Desbloquear' : 'Bloquear'}
                                                    </button>
                                                )}
                                                <button onClick={() => abrirEdicion(u)} className="action-btn" title="Editar"><Shield size={16} /></button>
                                                <button onClick={() => eliminarUsuario(u.id)} className="action-btn danger" title="Eliminar"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* SECCIÓN GRUPOS */}
                    {activeTab === 'grupos' && (
                        <div className="glass-card">
                            <div className="card-header">
                                <h2 className="card-title"><LayoutGrid size={24} color="var(--primary-color)" /> Grupos de Clase</h2>
                                <button onClick={() => setShowGroupModal(true)} className="action-btn" style={{ background: 'var(--primary-color)', color: 'white' }}>
                                    <Plus size={18} /> Crear Grupo
                                </button>
                            </div>
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Descripción</th>
                                        <th>Tutor/Profesor</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {grupos.map(g => (
                                        <tr key={g.id}>
                                            <td style={{ fontWeight: 'bold' }}>{g.nombre}</td>
                                            <td>{g.descripcion}</td>
                                            <td>{g.profesor?.email || 'Sin tutor'}</td>
                                            <td><span className={`status-badge ${g.activo ? 'status-active' : 'status-inactive'}`}>{g.activo ? 'Activo' : 'Inactivo'}</span></td>
                                        </tr>
                                    ))}
                                    {grupos.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', color: 'var(--text-muted)'}}>No hay grupos creados.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* SECCIÓN PERMISOS */}
                    {activeTab === 'permisos' && (
                        <>
                            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '4px solid var(--primary-color)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Roles</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>{roles.length}</div>
                                </div>
                                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '4px solid #10b981' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Roles Activos</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>{roles.filter(r => r.activo !== false).length}</div>
                                </div>
                                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Permisos Disponibles</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>{permisos.length}</div>
                                </div>
                                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px dashed var(--primary-color)', background: 'transparent' }} onClick={() => setShowRoleModal(true)}>
                                    <div style={{ textAlign: 'center', color: 'var(--primary-color)' }}>
                                        <Plus size={32} />
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>NUEVO ROL</div>
                                    </div>
                                </div>
                            </div>

                            {/* TABLA DE ROLES */}
                            <div className="glass-card" style={{ marginBottom: '2rem' }}>
                                <div className="card-header">
                                    <h3 className="card-title"><Shield size={20} color="var(--primary-color)" /> Roles del Sistema</h3>
                                </div>
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Nombre</th>
                                            <th>Descripción</th>
                                            <th>Tipo</th>
                                            <th>Permisos</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {roles.map(r => (
                                            <tr key={r.id}>
                                                <td style={{ fontWeight: 'bold' }}>{r.nombre}</td>
                                                <td>{r.descripcion || 'Sin descripción'}</td>
                                                <td>
                                                    {(() => {
                                                        const tipoColor = {
                                                            'Sistema':      { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
                                                            'Academico':    { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
                                                            'Personalizado':{ bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
                                                        };
                                                        const style = tipoColor[r.tipo] || tipoColor['Personalizado'];
                                                        return (
                                                            <span style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: '4px', background: style.bg, color: style.color, fontWeight: '600' }}>
                                                                {r.tipo || 'Sin tipo'}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{r.permisos?.length || 0}</div>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${r.activo !== false ? 'status-active' : 'status-inactive'}`}>
                                                        {r.activo !== false ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                                <td style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <button className="action-btn" title="Editar Rol" onClick={() => abrirEdicionRol(r)}><Shield size={14} /></button>
                                                    {r.tipo === 'Personalizado' && (
                                                        <button 
                                                            className="action-btn danger" 
                                                            title="Eliminar Rol"
                                                            onClick={() => eliminarRol(r.id)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="permissions-grid">
                            {roles.map(r => {
                                // Agrupar permisos por recurso para este rol
                                const groupedPerms = permisos.reduce((acc, p) => {
                                    const key = p.recurso || 'General';
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(p);
                                    return acc;
                                }, {});

                                return (
                                    <div key={r.id} className="glass-card">
                                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{r.nombre}</h3>
                                        {Object.entries(groupedPerms).map(([recurso, permsEnGrupo]) => (
                                            <div key={recurso} style={{ marginBottom: '1.5rem' }}>
                                                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', letterSpacing: '1px' }}>{recurso}</h4>
                                                {permsEnGrupo.map(p => {
                                                    const tiene = r.permisos?.some(rp => rp.id === p.id);
                                                    return (
                                                        <div key={p.id} className="perm-item">
                                                            <div>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{p.nombre}</div>
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.descripcion}</div>
                                                            </div>
                                                            <label className="toggle-switch">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={tiene} 
                                                                    onChange={() => togglePermiso(r.id, p.id, tiene)}
                                                                />
                                                                <span className="slider"></span>
                                                            </label>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                        </>
                    )}
                    {/* Modal Crear/Editar Usuario */}
                    {showUserModal && (
                        <div className="modal-overlay">
                            <div className="modal-content">
                                <div className="card-header">
                                    <h2>{editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h2>
                                    <button onClick={() => setShowUserModal(false)} className="action-btn"><X size={20} /></button>
                                </div>
                                <form onSubmit={manejarUsuario}>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input 
                                            type="email" 
                                            className="form-input" 
                                            required 
                                            value={userData.email} 
                                            onChange={(e) => setUserData({...userData, email: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contraseña {editingUser && '(Vacío para no cambiar)'}</label>
                                        <input 
                                            type="password" 
                                            className="form-input" 
                                            required={!editingUser} 
                                            value={userData.password} 
                                            onChange={(e) => setUserData({...userData, password: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Rol</label>
                                        <select 
                                            className="form-select" 
                                            required 
                                            value={userData.id_rol} 
                                            onChange={(e) => setUserData({...userData, id_rol: e.target.value})}
                                        >
                                            <option value="">-- Selecciona un Rol --</option>
                                            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                        </select>
                                    </div>
                                    <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%', marginTop: '1rem' }}>
                                        {editingUser ? 'Actualizar' : 'Crear'} Usuario
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Modal Crear Rol */}
                    {showRoleModal && (
                        <div className="modal-overlay">
                            <div className="modal-content">
                                <div className="card-header">
                                    <h2>Crear Nuevo Rol</h2>
                                    <button onClick={() => setShowRoleModal(false)} className="action-btn"><X size={20} /></button>
                                </div>
                                <form onSubmit={crearRol}>
                                    <div className="form-group">
                                        <label className="form-label">Nombre del Rol</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            required 
                                            placeholder="Ej: Editor, Moderador..."
                                            value={newRole.nombre} 
                                            onChange={(e) => setNewRole({...newRole, nombre: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tipo de Rol</label>
                                        <select 
                                            className="form-select" 
                                            required 
                                            value={newRole.id_tipo_rol} 
                                            onChange={(e) => setNewRole({...newRole, id_tipo_rol: e.target.value})}
                                        >
                                            <option value="">-- Selecciona un Tipo --</option>
                                            {tipoRoles.map(t => <option key={t.id_tipo_rol} value={t.id_tipo_rol}>{t.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Descripción</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="¿Qué puede hacer este rol?"
                                            value={newRole.descripcion} 
                                            onChange={(e) => setNewRole({...newRole, descripcion: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Permisos Iniciales</label>
                                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                                            {permisos.map(p => (
                                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={newRole.permisosIds.includes(p.id)}
                                                        onChange={(e) => {
                                                            const ids = e.target.checked 
                                                                ? [...newRole.permisosIds, p.id]
                                                                : newRole.permisosIds.filter(id => id !== p.id);
                                                            setNewRole({...newRole, permisosIds: ids});
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '0.8rem' }}>{p.nombre}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%', marginTop: '1rem' }}>
                                        Guardar Rol
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modal Asignar Estudiante */}
            {showAssignModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="card-header"><h2>Vincular Estudiante</h2><button onClick={() => setShowAssignModal(false)} className="action-btn"><X size={20} /></button></div>
                        <form onSubmit={manejarAsignacion}>
                            <div className="form-group">
                                <label className="form-label">Profesor</label>
                                <select className="form-select" required onChange={(e) => setAssignmentData({...assignmentData, id_profesor: e.target.value})}>
                                    <option value="">-- Elige --</option>
                                    {profesores.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Estudiante</label>
                                <select className="form-select" required onChange={(e) => setAssignmentData({...assignmentData, id_estudiante: e.target.value})}>
                                    <option value="">-- Elige --</option>
                                    {estudiantes.map(e => <option key={e.id} value={e.id}>{e.email}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%' }}>Asignar</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Crear Grupo */}
            {showGroupModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="card-header"><h2>Crear Nuevo Grupo</h2><button onClick={() => setShowGroupModal(false)} className="action-btn"><X size={20} /></button></div>
                        <form onSubmit={crearGrupo}>
                            <div className="form-group">
                                <label className="form-label">Nombre del Grupo</label>
                                <input type="text" className="form-input" required placeholder="Ej: Matemáticas 101" onChange={(e) => setNewGroup({...newGroup, nombre: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descripción</label>
                                <input type="text" className="form-input" placeholder="Opcional" onChange={(e) => setNewGroup({...newGroup, descripcion: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Asignar Profesor Tutor</label>
                                <select className="form-select" required onChange={(e) => setNewGroup({...newGroup, id_profesor: e.target.value})}>
                                    <option value="">-- Elige un profesor --</option>
                                    {profesores.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%' }}>Crear Grupo</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Editar Rol */}
            {showEditRoleModal && editingRole && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="card-header">
                            <h2>Editar Rol: {editingRole.nombre}</h2>
                            <button onClick={() => setShowEditRoleModal(false)} className="action-btn"><X size={20} /></button>
                        </div>
                        <form onSubmit={guardarEdicionRol}>
                            <div className="form-group">
                                <label className="form-label">Nombre</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    value={editRoleData.nombre}
                                    onChange={(e) => setEditRoleData({...editRoleData, nombre: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descripción</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={editRoleData.descripcion}
                                    onChange={(e) => setEditRoleData({...editRoleData, descripcion: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tipo de Rol</label>
                                <select
                                    className="form-select"
                                    value={editRoleData.id_tipo_rol}
                                    onChange={(e) => setEditRoleData({...editRoleData, id_tipo_rol: e.target.value})}
                                >
                                    <option value="">-- Sin cambiar --</option>
                                    {tipoRoles.map(t => <option key={t.id_tipo_rol} value={t.id_tipo_rol}>{t.nombre}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%', marginTop: '1rem' }}>
                                Guardar Cambios
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
