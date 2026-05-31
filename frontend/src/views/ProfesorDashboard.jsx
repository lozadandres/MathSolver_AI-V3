import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { BookOpen, Users, LogOut, Key, Copy, Trash2, UserMinus, Plus, LayoutGrid, Settings, FileText, ExternalLink, Edit3 } from 'lucide-react';
import ContextRoleBadge from '../components/ContextRoleBadge';
import ReBACManagementModal from '../components/ReBACManagementModal';
import SettingsModal from '../components/SettingsModal';
import ProfileAvatar from '../components/ProfileAvatar';
import TablePagination from '../components/TablePagination';
import SortableHeader from '../components/SortableHeader';
import usePagination from '../hooks/usePagination';
import useTableSort from '../hooks/useTableSort';
import useTableFilter from '../hooks/useTableFilter';
import '../styles/Dashboards.css';

const ProfesorDashboard = () => {
    const { user, logout, theme, toggleTheme, hasPermission } = useAuth();
    const [alumnos, setAlumnos] = useState([]);
    const [codigos, setCodigos] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [editingCode, setEditingCode] = useState(null);
    const [editCodeData, setEditCodeData] = useState({ id_grupo: '', usos_maximos: '', activo: true, fecha_expiracion: '' });
    const [selectedGrupo, setSelectedGrupo] = useState('');
    const [maxUsos, setMaxUsos] = useState('');
    const [showCreateClassModal, setShowCreateClassModal] = useState(false);
    const [newClassData, setNewClassData] = useState({ nombre: '', descripcion: '' });
    const [showManageModal, setShowManageModal] = useState(false);
    const [managingGroup, setManagingGroup] = useState(null);
    const [groupRoles, setGroupRoles] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [groupFilter, setGroupFilter] = useState('todos');
    const [tableFilters, setTableFilters] = useState({ grupos: '', codigos: '', alumnos: '' });
    const [materialsGroup, setMaterialsGroup] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [materialsLoading, setMaterialsLoading] = useState(false);
    const [materialForm, setMaterialForm] = useState({
        titulo: '',
        descripcion: '',
        tipo: 'archivo',
        contenido: '',
        visible_estudiantes: true,
        archivo: null
    });
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

    const abrirEdicionCodigo = (codigo) => {
        setEditingCode(codigo);
        setEditCodeData({
            id_grupo: codigo.id_grupo || codigo.grupo?.id_grupo || '',
            usos_maximos: codigo.usos_maximos || '',
            activo: Boolean(codigo.activo),
            fecha_expiracion: codigo.fecha_expiracion ? String(codigo.fecha_expiracion).slice(0, 10) : ''
        });
    };

    const guardarEdicionCodigo = async (e) => {
        e.preventDefault();
        if (!editingCode) return;

        const usos = editCodeData.usos_maximos === '' ? null : parseInt(editCodeData.usos_maximos, 10);
        if (usos !== null && usos < (editingCode.usos_actuales || 0)) {
            alert(`El limite no puede ser menor que los usos actuales (${editingCode.usos_actuales || 0}).`);
            return;
        }

        try {
            await api.put(`/profesor/codigo/${editingCode.id_codigo}`, {
                id_grupo: editCodeData.id_grupo || null,
                usos_maximos: editCodeData.usos_maximos === '' ? null : usos,
                activo: editCodeData.activo,
                fecha_expiracion: editCodeData.fecha_expiracion || null
            });
            setEditingCode(null);
            setEditCodeData({ id_grupo: '', usos_maximos: '', activo: true, fecha_expiracion: '' });
            cargarDatos();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al editar codigo');
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

    const setTableFilter = (key, value) => setTableFilters((current) => ({ ...current, [key]: value }));
    const filteredGroupsByRole = grupos.filter(g => {
        if (groupFilter === 'director') return g.roles_en_grupo?.includes('director_grupo');
        if (groupFilter === 'invitado') return !g.roles_en_grupo?.includes('director_grupo');
        return true;
    });
    const filteredGroups = useTableFilter(filteredGroupsByRole, tableFilters.grupos, [
        (item) => item.nombre,
        (item) => item.descripcion,
        (item) => item.roles_en_grupo?.join(' ')
    ]);
    const filteredCodigos = useTableFilter(codigos, tableFilters.codigos, [
        (item) => item.codigo,
        (item) => item.grupo?.nombre || 'General',
        (item) => item.activo ? 'Activo' : 'Inactivo'
    ]);
    const filteredAlumnos = useTableFilter(alumnos, tableFilters.alumnos, [
        (item) => item.email,
        (item) => getClasesAlumno(item).map((clase) => clase.nombre).join(', '),
        (item) => item.activo ? 'Activo' : 'Inactivo'
    ]);
    const gruposSort = useTableSort(filteredGroups, 'nombre', 'asc', {
        nombre: (item) => item.nombre,
        alumnos: (item) => item.integrantes?.length || 0,
        descripcion: (item) => item.descripcion
    });
    const codigosSort = useTableSort(filteredCodigos, 'codigo', 'asc', {
        codigo: (item) => item.codigo,
        clase: (item) => item.grupo?.nombre || 'General',
        usos: (item) => item.usos_actuales || 0,
        estado: (item) => item.activo ? 'Activo' : 'Inactivo'
    });
    const alumnosSort = useTableSort(filteredAlumnos, 'email', 'asc', {
        email: (item) => item.email,
        clase: (item) => getClasesAlumno(item).map((clase) => clase.nombre).join(', '),
        estado: (item) => item.activo ? 'Activo' : 'Inactivo'
    });
    const materialesSort = useTableSort(materials, 'titulo', 'asc', {
        titulo: (item) => item.titulo,
        tipo: (item) => item.tipo,
        visible: (item) => item.visible_estudiantes ? 'Visible' : 'Oculto'
    });
    const gruposPagination = usePagination(gruposSort.sortedItems, 5, `${groupFilter}-${tableFilters.grupos}-${gruposSort.sortKey}-${gruposSort.direction}`);
    const codigosPagination = usePagination(codigosSort.sortedItems, 5, `${tableFilters.codigos}-${codigosSort.sortKey}-${codigosSort.direction}`);
    const alumnosPagination = usePagination(alumnosSort.sortedItems, 5, `${tableFilters.alumnos}-${alumnosSort.sortKey}-${alumnosSort.direction}`);
    const materialesPagination = usePagination(materialesSort.sortedItems, 5, `${materialsGroup?.id || materialsGroup?.id_grupo || ''}-${materialesSort.sortKey}-${materialesSort.direction}`);

    const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
    const resolveFileUrl = (url) => {
        if (!url) return null;
        if (/^https?:\/\//i.test(url)) return url;
        return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`;
    };

    const cargarMateriales = async (grupo) => {
        setMaterialsGroup(grupo);
        setMaterialsLoading(true);
        try {
            const res = await api.get(`/grupos/${grupo.id || grupo.id_grupo}/documentos`);
            setMaterials(res.data);
        } catch (error) {
            alert(error.response?.data?.error || 'Error al cargar materiales');
        } finally {
            setMaterialsLoading(false);
        }
    };

    const publicarMaterial = async (e) => {
        e.preventDefault();
        if (!materialsGroup) return;

        const formData = new FormData();
        formData.append('titulo', materialForm.titulo);
        formData.append('descripcion', materialForm.descripcion);
        formData.append('tipo', materialForm.tipo);
        formData.append('contenido', materialForm.contenido);
        formData.append('visible_estudiantes', String(materialForm.visible_estudiantes));
        if (materialForm.archivo) formData.append('archivo', materialForm.archivo);

        try {
            await api.post(`/grupos/${materialsGroup.id || materialsGroup.id_grupo}/documentos`, formData);
            setMaterialForm({ titulo: '', descripcion: '', tipo: 'archivo', contenido: '', visible_estudiantes: true, archivo: null });
            await cargarMateriales(materialsGroup);
        } catch (error) {
            alert(error.response?.data?.error || 'Error al publicar material');
        }
    };

    const eliminarMaterial = async (documentoId) => {
        if (!confirm('Eliminar este material de clase?')) return;
        try {
            await api.delete(`/documentos/${documentoId}`);
            await cargarMateriales(materialsGroup);
        } catch (error) {
            alert(error.response?.data?.error || 'Error al eliminar material');
        }
    };


    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="dashboard-header-left">
                    <BookOpen size={40} color="var(--primary-color)" />
                    <h1 style={{ fontSize: '2rem' }}>Panel del Profesor</h1>
                </div>
                <div className="dashboard-header-right">
                    <ProfileAvatar user={user} size={42} />
                    <div className="user-badge">Profesor: {user?.email}</div>
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
                    <div className="table-filter-row">
                        <input
                            className="form-input"
                            placeholder="Filtrar materias"
                            value={tableFilters.grupos}
                            onChange={(e) => setTableFilter('grupos', e.target.value)}
                        />
                    </div>
                    {loading ? <p>Cargando...</p> : (
                        <div className="permissions-grid" style={{ gridTemplateColumns: '1fr' }}>
                            {gruposPagination.pageItems.map(g => (
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
                                        {canManageGroups && !g.roles_en_grupo?.includes('director_grupo') && (
                                            <button onClick={() => cargarMateriales(g)} className="action-btn" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}>
                                                <FileText size={14} /> Materiales
                                            </button>
                                        )}
                                        {canManageGroups && g.roles_en_grupo?.includes('director_grupo') && (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => cargarMateriales(g)} className="action-btn" style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}>
                                                    <FileText size={14} /> Materiales
                                                </button>
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
                            <TablePagination pagination={gruposPagination} />
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

                    <div className="table-filter-row">
                        <input
                            className="form-input"
                            placeholder="Filtrar códigos"
                            value={tableFilters.codigos}
                            onChange={(e) => setTableFilter('codigos', e.target.value)}
                        />
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
                                        <SortableHeader label="Código" sortKey="codigo" sort={codigosSort} />
                                        <SortableHeader label="Clase / Destino" sortKey="clase" sort={codigosSort} />
                                        <SortableHeader label="Usos" sortKey="usos" sort={codigosSort} />
                                        <SortableHeader label="Estado" sortKey="estado" sort={codigosSort} />
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {codigosPagination.pageItems.map(c => (
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
                                                <button onClick={() => abrirEdicionCodigo(c)} className="action-btn" title="Editar">
                                                    <Edit3 size={16} />
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
                                    {filteredCodigos.length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay códigos para este filtro.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!loading && <TablePagination pagination={codigosPagination} />}
                </div>
                )}

                {editingCode && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="card-header">
                                <h2>Editar codigo de invitacion</h2>
                                <button onClick={() => setEditingCode(null)} className="action-btn">
                                    <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
                                </button>
                            </div>
                            <form onSubmit={guardarEdicionCodigo}>
                                <div className="form-group">
                                    <label className="form-label">Codigo</label>
                                    <input className="form-input" value={editingCode.codigo} disabled style={{ letterSpacing: '1px', fontFamily: 'monospace', fontWeight: 800 }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Clase / destino</label>
                                    <select
                                        className="form-select"
                                        value={editCodeData.id_grupo}
                                        onChange={(e) => setEditCodeData({ ...editCodeData, id_grupo: e.target.value })}
                                    >
                                        <option value="">General (Sin Grupo)</option>
                                        {grupos.map(g => (
                                            <option key={g.id || g.id_grupo} value={g.id || g.id_grupo}>{g.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Limite de usos</label>
                                    <input
                                        type="number"
                                        min={editingCode.usos_actuales || 1}
                                        className="form-input"
                                        value={editCodeData.usos_maximos}
                                        onChange={(e) => setEditCodeData({ ...editCodeData, usos_maximos: e.target.value })}
                                        placeholder="Vacio para ilimitado"
                                    />
                                    <small style={{ color: 'var(--text-muted)' }}>Usos actuales: {editingCode.usos_actuales || 0}</small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha de expiracion</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={editCodeData.fecha_expiracion}
                                        onChange={(e) => setEditCodeData({ ...editCodeData, fecha_expiracion: e.target.value })}
                                    />
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={editCodeData.activo}
                                        onChange={(e) => setEditCodeData({ ...editCodeData, activo: e.target.checked })}
                                    />
                                    Codigo activo
                                </label>
                                <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%', padding: '1rem' }}>
                                    Guardar cambios
                                </button>
                            </form>
                        </div>
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
                    <div className="table-filter-row">
                        <input
                            className="form-input"
                            placeholder="Filtrar alumnos"
                            value={tableFilters.alumnos}
                            onChange={(e) => setTableFilter('alumnos', e.target.value)}
                        />
                    </div>

                    {loading ? <p>Cargando...</p> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <SortableHeader label="Email" sortKey="email" sort={alumnosSort} />
                                        <SortableHeader label="Clase asociada" sortKey="clase" sort={alumnosSort} />
                                        <SortableHeader label="Estado" sortKey="estado" sort={alumnosSort} />
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alumnosPagination.pageItems.map(a => (
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
                                    {filteredAlumnos.length === 0 && (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay alumnos para este filtro.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!loading && <TablePagination pagination={alumnosPagination} />}
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

                {materialsGroup && (
                    <div className="modal-overlay">
                        <div className="modal-content" style={{ maxWidth: 920 }}>
                            <div className="card-header">
                                <h2>Materiales: {materialsGroup.nombre}</h2>
                                <button onClick={() => setMaterialsGroup(null)} className="action-btn">
                                    <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
                                </button>
                            </div>

                            <form onSubmit={publicarMaterial} style={{ marginBottom: '1.25rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Titulo</label>
                                    <input className="form-input" required value={materialForm.titulo} onChange={e => setMaterialForm({ ...materialForm, titulo: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descripcion</label>
                                    <input className="form-input" value={materialForm.descripcion} onChange={e => setMaterialForm({ ...materialForm, descripcion: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo</label>
                                    <select className="form-select" value={materialForm.tipo} onChange={e => setMaterialForm({ ...materialForm, tipo: e.target.value, archivo: null, contenido: '' })}>
                                        <option value="archivo">PDF o imagen</option>
                                        <option value="enlace">Enlace externo</option>
                                        <option value="texto">Texto / guia</option>
                                        <option value="tarea">Tarea</option>
                                    </select>
                                </div>
                                {materialForm.tipo === 'archivo' ? (
                                    <div className="form-group">
                                        <label className="form-label">Archivo PDF o imagen</label>
                                        <input className="form-input" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required onChange={e => setMaterialForm({ ...materialForm, archivo: e.target.files?.[0] || null })} />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">{materialForm.tipo === 'enlace' ? 'URL' : 'Contenido'}</label>
                                        <textarea className="form-input" required rows={4} value={materialForm.contenido} onChange={e => setMaterialForm({ ...materialForm, contenido: e.target.value })} />
                                    </div>
                                )}
                                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                                    <input type="checkbox" checked={materialForm.visible_estudiantes} onChange={e => setMaterialForm({ ...materialForm, visible_estudiantes: e.target.checked })} />
                                    Visible para estudiantes
                                </label>
                                <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%' }}>
                                    <Plus size={16} /> Publicar material
                                </button>
                            </form>

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
                                                        <span className={`status-badge ${doc.visible_estudiantes ? 'status-active' : 'status-inactive'}`}>
                                                            {doc.visible_estudiantes ? 'Visible' : 'Oculto'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {doc.archivo_url && (
                                                        <a className="action-btn" href={resolveFileUrl(doc.archivo_url)} target="_blank" rel="noreferrer">
                                                            <ExternalLink size={16} />
                                                        </a>
                                                    )}
                                                    {doc.tipo === 'enlace' && doc.contenido && (
                                                        <a className="action-btn" href={doc.contenido} target="_blank" rel="noreferrer">
                                                            <ExternalLink size={16} />
                                                        </a>
                                                    )}
                                                    <button className="action-btn danger" onClick={() => eliminarMaterial(doc.id)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            {(doc.tipo === 'texto' || doc.tipo === 'tarea') && doc.contenido && (
                                                <p style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', marginBottom: 0 }}>{doc.contenido}</p>
                                            )}
                                        </div>
                                    ))}
                                    {materials.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aun no hay materiales publicados.</p>}
                                    <TablePagination pagination={materialesPagination} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            </div>
        </div>
    );
};

export default ProfesorDashboard;
