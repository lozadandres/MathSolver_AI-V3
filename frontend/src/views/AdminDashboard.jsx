import { Fragment, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Users, Shield, LogOut, Trash2, X, LayoutGrid, Key, Plus, FileText, AlertTriangle, Activity, Bot, CheckCircle, Lock, Edit3, BarChart3, PieChart, TrendingUp, Settings } from 'lucide-react';
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

const AdminDashboard = () => {
    const { user, logout, theme, toggleTheme } = useAuth();
    const [activeTab, setActiveTab] = useState('usuarios');
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    // Estados para Usuarios
    const [usuarios, setUsuarios] = useState([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userData, setUserData] = useState({ email: '', password: '', id_rol: '' });

    // Estados para Grupos
    const [grupos, setGrupos] = useState([]);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [newGroup, setNewGroup] = useState({ nombre: '', descripcion: '', id_profesor: '' });
    const [expandedGroupId, setExpandedGroupId] = useState(null);
    const [groupContextRoles, setGroupContextRoles] = useState({});
    const [rebacGroup, setRebacGroup] = useState(null);

    // Estados para Roles y Permisos
    const [roles, setRoles] = useState([]);
    const [permisos, setPermisos] = useState([]);
    const [tipoRoles, setTipoRoles] = useState([]);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [newRole, setNewRole] = useState({ nombre: '', descripcion: '', permisosIds: [] });
    const [showEditRoleModal, setShowEditRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [editRoleData, setEditRoleData] = useState({ nombre: '', descripcion: '', id_tipo_rol: '' });
    const [auditLogs, setAuditLogs] = useState([]);
    const [actionLogs, setActionLogs] = useState([]);
    const [sessionLogs, setSessionLogs] = useState([]);
    const [logStats, setLogStats] = useState({ totalAcciones: 0, accionesFallidas: 0, sesionesActivas: 0, consultasIA: 0 });
    const [auditFilters, setAuditFilters] = useState({ fecha: 'semana', seccion: '', nivel: '', id_usuario: '', categoria: '', exito: '', accion: '' });
    const [activeLogTab, setActiveLogTab] = useState('acciones');
    const [tableFilters, setTableFilters] = useState({ usuarios: '', grupos: '', roles: '' });
    const [selectedAuditLog, setSelectedAuditLog] = useState(null);
    const [selectedUserRoles, setSelectedUserRoles] = useState(null);
    const [chartTooltip, setChartTooltip] = useState(null);

    useEffect(() => {
        cargarTodo();
    }, []);

    const cargarTodo = async () => {
        setLoading(true);
        try {
            const [resUsers, resGroups, resRoles, resPerms, resTipoRoles, resAudit, resActions, resSessions, resStats] = await Promise.all([
                api.get('/admin/usuarios'),
                api.get('/admin/grupos'),
                api.get('/admin/roles'),
                api.get('/admin/permisos'),
                api.get('/admin/tipo-roles'),
                api.get('/admin/logs/auditoria?limit=500').catch(() => ({ data: [] })),
                api.get('/admin/logs/acciones?limit=500').catch(() => ({ data: [] })),
                api.get('/admin/logs/sesiones?limit=500').catch(() => ({ data: [] })),
                api.get('/admin/logs/stats').catch(() => ({ data: { totalAcciones: 0, accionesFallidas: 0, sesionesActivas: 0, consultasIA: 0 } }))
            ]);
            setUsuarios(resUsers.data);
            setGrupos(resGroups.data);
            setRoles(resRoles.data);
            setPermisos(resPerms.data);
            setTipoRoles(resTipoRoles.data);
            setAuditLogs(resAudit.data);
            setActionLogs(resActions.data);
            setSessionLogs(resSessions.data);
            setLogStats(resStats.data);
        } catch (error) {
            console.error("Error cargando datos", error);
        } finally {
            setLoading(false);
        }
    };

    const cargarAuditoria = async (filters = auditFilters) => {
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });
            params.set('limit', '500');
            const res = await api.get(`/admin/logs/auditoria?${params.toString()}`);
            const resActions = await api.get(`/admin/logs/acciones?${params.toString()}`).catch(() => ({ data: [] }));
            const resSessions = await api.get(`/admin/logs/sesiones?${params.toString()}`).catch(() => ({ data: [] }));
            const resStats = await api.get('/admin/logs/stats').catch(() => ({ data: logStats }));
            setAuditLogs(res.data);
            setActionLogs(resActions.data);
            setSessionLogs(resSessions.data);
            setLogStats(resStats.data);
        } catch (error) {
            console.error("Error cargando auditoria", error);
        }
    };

    const cambiarFiltroAuditoria = (key, value) => {
        const nextFilters = { ...auditFilters, [key]: value };
        setAuditFilters(nextFilters);
        cargarAuditoria(nextFilters);
    };

    const actionVisual = (log) => {
        if (log.resultado === 'DENIED' || log.accion?.includes('DENIED')) return { color: '#ef4444', icon: <AlertTriangle size={14} /> };
        if (log.accion?.includes('DELETE') || log.accion?.includes('REVOKE') || log.accion?.includes('DISABLE')) return { color: '#f97316', icon: <Trash2 size={14} /> };
        if (log.accion?.includes('CREATE') || log.accion?.includes('JOIN') || log.accion?.includes('SUCCESS')) return { color: '#10b981', icon: <CheckCircle size={14} /> };
        if (log.seccion === 'IA' || log.accion?.includes('AI')) return { color: '#a78bfa', icon: <Bot size={14} /> };
        if (log.accion?.includes('LOGIN') || log.accion?.includes('TOKEN')) return { color: '#60a5fa', icon: <Key size={14} /> };
        if (log.accion?.includes('BLOCK')) return { color: '#ef4444', icon: <Lock size={14} /> };
        if (log.accion?.includes('UPDATE') || log.accion?.includes('EDIT') || log.accion?.includes('ROLE')) return { color: '#f59e0b', icon: <Edit3 size={14} /> };
        return { color: 'var(--text-muted)', icon: <Activity size={14} /> };
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

    const cargarRolesContextualesGrupo = async (groupId) => {
        try {
            const res = await api.get(`/admin/grupos/${groupId}/roles-contextuales`);
            setGroupContextRoles(prev => ({ ...prev, [groupId]: res.data }));
            return res.data;
        } catch (error) {
            if (error.response?.status === 401) {
                alert('Tu sesión expiró. Vuelve a iniciar sesión para gestionar roles ReBAC.');
                return null;
            }
            alert(error.response?.data?.error || 'Error al cargar roles contextuales del grupo');
            return null;
        }
    };

    const toggleGrupoExpandido = async (groupId) => {
        const nextGroupId = expandedGroupId === groupId ? null : groupId;
        setExpandedGroupId(nextGroupId);
        if (nextGroupId && !groupContextRoles[nextGroupId]) {
            const roles = await cargarRolesContextualesGrupo(nextGroupId);
            if (!roles) setExpandedGroupId(null);
        }
    };

    const abrirGestionReBACAdmin = async (grupo) => {
        const roles = await cargarRolesContextualesGrupo(grupo.id);
        if (roles) setRebacGroup(grupo);
    };

    const asignarRolContextualAdmin = async (roleData) => {
        try {
            await api.post(`/admin/grupos/${rebacGroup.id}/roles-contextuales/bulk`, roleData);
            await cargarRolesContextualesGrupo(rebacGroup.id);
            cargarTodo();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al asignar rol contextual');
        }
    };

    const revocarRolContextualAdmin = async (relationId) => {
        if (!confirm('Revocar este rol contextual?')) return;
        try {
            await api.delete(`/admin/grupos/${rebacGroup.id}/roles-contextuales/${relationId}`);
            await cargarRolesContextualesGrupo(rebacGroup.id);
            cargarTodo();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al revocar rol contextual');
        }
    };

    const verRolesUsuario = async (usuario) => {
        try {
            const res = await api.get(`/admin/usuarios/${usuario.id}/roles-contextuales`);
            setSelectedUserRoles({ usuario, roles: res.data });
        } catch (error) {
            alert(error.response?.data?.error || 'Error al cargar roles contextuales del usuario');
        }
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
    const usuariosAsignables = usuarios.filter(u => u.role !== 'Admin');
    const formatLogDate = (value) => value ? new Date(value).toLocaleString() : 'Sin fecha';
    const getGrupoTutorLabel = (grupo) => {
        if (grupo.profesor?.email) return grupo.profesor.email;

        const roles = grupo.roles_contextuales || groupContextRoles[grupo.id] || [];
        const principal = roles.find(role => role.relacion === 'director_grupo')
            || roles.find(role => role.relacion === 'tutor_asistente')
            || roles.find(role => role.relacion === 'profesor_materia');

        return principal?.email || null;
    };
    const countBy = (items, getKey) => items.reduce((acc, item) => {
        const key = getKey(item) || 'Sin dato';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    const roleDistribution = Object.entries(countBy(usuarios, u => u.role)).map(([label, value]) => ({ label, value }));
    const groupStatusData = [
        { label: 'Activas', value: grupos.filter(g => g.activo !== false).length },
        { label: 'Inactivas', value: grupos.filter(g => g.activo === false).length }
    ];
    const actionSectionData = Object.entries(countBy(actionLogs, log => log.seccion)).map(([label, value]) => ({ label, value }));
    const actionTypeData = Object.entries(countBy(actionLogs, log => log.accion)).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    const sessionDeviceData = Object.entries(countBy(sessionLogs, session => session.cliente?.dispositivo)).map(([label, value]) => ({ label, value }));
    const recentActivityData = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = date.toISOString().slice(0, 10);
        return {
            label: date.toLocaleDateString(undefined, { weekday: 'short' }),
            value: actionLogs.filter(log => log.fecha_creacion?.slice(0, 10) === key).length
        };
    });
    const topUsersData = Object.entries(countBy(actionLogs, log => log.usuario?.email || (log.id_usuario ? `Usuario #${log.id_usuario}` : 'Sistema')))
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    const maxRoleCount = Math.max(...roleDistribution.map(item => item.value), 1);
    const maxActionCount = Math.max(...actionSectionData.map(item => item.value), 1);
    const maxActionTypeCount = Math.max(...actionTypeData.map(item => item.value), 1);
    const maxRecentActivityCount = Math.max(...recentActivityData.map(item => item.value), 1);
    const maxTopUserCount = Math.max(...topUsersData.map(item => item.value), 1);
    const activeUsers = usuarios.filter(u => !u.bloqueado && u.activo !== false).length;
    const blockedUsers = usuarios.filter(u => u.bloqueado).length;
    const activeSessions = logStats.sesionesActivas || sessionLogs.filter(session => session.estado === 'ACTIVA').length;
    const failureRate = logStats.totalAcciones > 0 ? Math.round((logStats.accionesFallidas / logStats.totalAcciones) * 100) : 0;
    const aiShare = logStats.totalAcciones > 0 ? Math.round((logStats.consultasIA / logStats.totalAcciones) * 100) : 0;
    const averageStudentsPerClass = grupos.length > 0
        ? Math.round(grupos.reduce((sum, group) => sum + (group.integrantes?.length || 0), 0) / grupos.length)
        : 0;
    const securitySignals = [
        { label: 'Acciones fallidas 24h', value: logStats.accionesFallidas || 0, color: '#ef4444' },
        { label: 'Usuarios bloqueados', value: blockedUsers, color: '#f97316' },
        { label: 'Sesiones activas', value: activeSessions, color: '#10b981' },
        { label: 'Tasa de fallos', value: `${failureRate}%`, color: failureRate > 20 ? '#ef4444' : '#10b981' }
    ];
    const setTableFilter = (key, value) => setTableFilters((current) => ({ ...current, [key]: value }));
    const filteredUsuarios = useTableFilter(usuarios, tableFilters.usuarios, [
        (item) => item.email,
        (item) => item.role,
        (item) => item.bloqueado ? 'Bloqueado' : 'Activo'
    ]);
    const filteredAdminGroups = useTableFilter(grupos, tableFilters.grupos, [
        (item) => item.nombre,
        (item) => item.descripcion,
        (item) => getGrupoTutorLabel(item),
        (item) => item.activo ? 'Activo' : 'Inactivo'
    ]);
    const filteredRoles = useTableFilter(roles, tableFilters.roles, [
        (item) => item.nombre,
        (item) => item.descripcion,
        (item) => item.tipo,
        (item) => item.activo !== false ? 'Activo' : 'Inactivo'
    ]);
    const usuariosSort = useTableSort(filteredUsuarios, 'email', 'asc', {
        email: (item) => item.email,
        perfil: (item) => item.role,
        estado: (item) => item.bloqueado ? 'Bloqueado' : 'Activo'
    });
    const gruposSort = useTableSort(filteredAdminGroups, 'nombre', 'asc', {
        nombre: (item) => item.nombre,
        descripcion: (item) => item.descripcion,
        tutor: (item) => getGrupoTutorLabel(item),
        estado: (item) => item.activo ? 'Activo' : 'Inactivo'
    });
    const rolesSort = useTableSort(filteredRoles, 'nombre', 'asc', {
        nombre: (item) => item.nombre,
        descripcion: (item) => item.descripcion,
        tipo: (item) => item.tipo,
        permisos: (item) => item.permisos?.length || 0,
        estado: (item) => item.activo !== false ? 'Activo' : 'Inactivo'
    });
    const actionLogsSort = useTableSort(actionLogs, 'fecha', 'desc', {
        fecha: (item) => item.fecha_creacion,
        resultado: (item) => item.resultado,
        seccion: (item) => item.seccion,
        accion: (item) => item.accion,
        usuario: (item) => item.usuario?.email || item.id_usuario || 'Sistema',
        cliente: (item) => item.cliente ? `${item.cliente.navegador} ${item.cliente.sistema_operativo}` : '',
        descripcion: (item) => item.descripcion
    });
    const sessionLogsSort = useTableSort(sessionLogs, 'inicio', 'desc', {
        inicio: (item) => item.fecha_inicio,
        fin: (item) => item.fecha_fin,
        estado: (item) => item.estado,
        usuario: (item) => item.usuario?.email || item.id_usuario,
        dispositivo: (item) => item.cliente?.dispositivo,
        navegador: (item) => item.cliente ? `${item.cliente.navegador} ${item.cliente.sistema_operativo}` : '',
        ip: (item) => item.ip_address
    });
    const auditLogsSort = useTableSort(auditLogs, 'fecha', 'desc', {
        fecha: (item) => item.fecha_creacion,
        nivel: (item) => item.nivel,
        seccion: (item) => item.seccion,
        accion: (item) => item.accion,
        usuario: (item) => item.usuario?.email || item.id_usuario || 'Sistema',
        descripcion: (item) => item.descripcion
    });
    const usuariosPagination = usePagination(usuariosSort.sortedItems, 5, `${activeTab}-${usuariosSort.sortKey}-${usuariosSort.direction}`);
    const gruposPagination = usePagination(gruposSort.sortedItems, 5, `${activeTab}-${gruposSort.sortKey}-${gruposSort.direction}`);
    const rolesPagination = usePagination(rolesSort.sortedItems, 5, `${activeTab}-${rolesSort.sortKey}-${rolesSort.direction}`);
    const actionLogsPagination = usePagination(actionLogsSort.sortedItems, 5, `${activeLogTab}-${auditFilters.fecha}-${auditFilters.categoria}-${auditFilters.exito}-${auditFilters.nivel}-${auditFilters.id_usuario}-${auditFilters.accion}-${actionLogsSort.sortKey}-${actionLogsSort.direction}`);
    const sessionLogsPagination = usePagination(sessionLogsSort.sortedItems, 5, `${activeLogTab}-${auditFilters.fecha}-${auditFilters.id_usuario}-${sessionLogsSort.sortKey}-${sessionLogsSort.direction}`);
    const auditLogsPagination = usePagination(auditLogsSort.sortedItems, 5, `${activeLogTab}-${auditFilters.fecha}-${auditFilters.seccion}-${auditFilters.nivel}-${auditFilters.id_usuario}-${auditLogsSort.sortKey}-${auditLogsSort.direction}`);
    const permisosPorRecurso = permisos.reduce((acc, permiso) => {
        const key = permiso.recurso || 'General';
        if (!acc[key]) acc[key] = [];
        acc[key].push(permiso);
        return acc;
    }, {});
    const recursosPermisos = Object.entries(permisosPorRecurso);
    const permisoActivoEnRol = (rol, permiso) => rol.permisos?.some(rolePermission => rolePermission.id === permiso.id);
    const statCard = (label, value, hint, color, icon) => (
        <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderLeft: `4px solid ${color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color }}>
                {icon}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem' }}>{value}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{hint}</div>
        </div>
    );
    const showChartTooltip = (event, title, value, subtitle) => {
        setChartTooltip({
            x: event.clientX + 14,
            y: event.clientY + 14,
            title,
            value,
            subtitle
        });
    };
    const hideChartTooltip = () => setChartTooltip(null);
    const barList = (data, max, color = 'var(--primary-color)') => (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
            {data.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Sin datos disponibles.</span>}
            {data.map(item => (
                <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                    </div>
                    <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(5, (item.value / max) * 100)}%`, height: '100%', background: color, borderRadius: '999px' }} />
                    </div>
                </div>
            ))}
        </div>
    );
    const donut = (value, total, color, label) => {
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 118, height: 118, borderRadius: '50%', background: `conic-gradient(${color} ${percent}%, rgba(255,255,255,0.08) 0)`, display: 'grid', placeItems: 'center' }}>
                    <div style={{ width: 82, height: 82, borderRadius: '50%', background: 'var(--card-bg, #111827)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '1.35rem' }}>{percent}%</div>
                </div>
                <div>
                    <div style={{ fontWeight: 800 }}>{label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{value} de {total}</div>
                </div>
            </div>
        );
    };
    const verticalBars = (data, max, color = 'var(--primary-color)') => (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(38px, 1fr))`, alignItems: 'end', gap: '0.75rem', minHeight: '230px', paddingTop: '1rem' }}>
            {data.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Sin datos disponibles.</span>}
            {data.map(item => {
                const height = max > 0 ? Math.max(10, (item.value / max) * 160) : 10;
                return (
                    <div key={item.label} style={{ display: 'grid', gap: '0.45rem', alignItems: 'end', justifyItems: 'center' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{item.value}</strong>
                        <div style={{ width: '100%', height: 170, display: 'flex', alignItems: 'end', justifyContent: 'center', borderBottom: '1px solid var(--glass-border)' }}>
                            <div
                                title={`${item.label}: ${item.value}`}
                                onMouseEnter={(event) => showChartTooltip(event, item.label, item.value, 'Acciones registradas')}
                                onMouseMove={(event) => showChartTooltip(event, item.label, item.value, 'Acciones registradas')}
                                onMouseLeave={hideChartTooltip}
                                style={{
                                    width: '70%',
                                    maxWidth: 46,
                                    height,
                                    borderRadius: '8px 8px 2px 2px',
                                    background: `linear-gradient(180deg, ${color}, rgba(255,255,255,0.18))`,
                                    boxShadow: `0 10px 24px ${color}33`,
                                    cursor: 'pointer',
                                    transition: 'filter 160ms ease, transform 160ms ease'
                                }}
                            />
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', minHeight: 32 }}>{item.label}</span>
                    </div>
                );
            })}
        </div>
    );
    const lineChart = (data, color = '#60a5fa') => {
        const width = 560;
        const height = 220;
        const padding = 30;
        const max = Math.max(...data.map(item => item.value), 1);
        const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
        const points = data.map((item, index) => ({
            ...item,
            x: padding + index * step,
            y: height - padding - (item.value / max) * (height - padding * 2)
        }));
        const polyline = points.map(point => `${point.x},${point.y}`).join(' ');
        const area = points.length > 0
            ? `${padding},${height - padding} ${polyline} ${width - padding},${height - padding}`
            : '';

        return (
            <div style={{ overflowX: 'auto' }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: 360, height: 230 }}>
                    <defs>
                        <linearGradient id="activityArea" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                    {[0, 1, 2, 3].map(line => {
                        const y = padding + line * ((height - padding * 2) / 3);
                        return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
                    })}
                    {area && <polygon points={area} fill="url(#activityArea)" />}
                    {polyline && <polyline points={polyline} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                    {points.map(point => (
                        <g
                            key={point.label}
                            onMouseEnter={(event) => showChartTooltip(event, point.label, point.value, 'Actividad del día')}
                            onMouseMove={(event) => showChartTooltip(event, point.label, point.value, 'Actividad del día')}
                            onMouseLeave={hideChartTooltip}
                            style={{ cursor: 'pointer' }}
                        >
                            <circle cx={point.x} cy={point.y} r="16" fill="transparent" />
                            <circle cx={point.x} cy={point.y} r="5" fill={color} stroke="var(--card-bg, #111827)" strokeWidth="3" />
                            <circle cx={point.x} cy={point.y} r="9" fill="none" stroke={color} strokeOpacity="0.24" strokeWidth="2" />
                            <text x={point.x} y={height - 8} fill="var(--text-muted)" fontSize="12" textAnchor="middle">{point.label}</text>
                        </g>
                    ))}
                </svg>
            </div>
        );
    };
    const stackedSegments = (data, colors = ['#6366f1', '#10b981', '#f59e0b', '#a78bfa']) => {
        const total = data.reduce((sum, item) => sum + item.value, 0);
        return (
            <div style={{ display: 'grid', gap: '0.9rem' }}>
                <div style={{ display: 'flex', height: 18, overflow: 'hidden', borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>
                    {data.map((item, index) => (
                        <div
                            key={item.label}
                            title={`${item.label}: ${item.value}`}
                            style={{
                                width: total > 0 ? `${(item.value / total) * 100}%` : '0%',
                                background: colors[index % colors.length],
                                minWidth: item.value > 0 ? 8 : 0
                            }}
                        />
                    ))}
                </div>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                    {data.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Sin datos disponibles.</span>}
                    {data.map((item, index) => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                                <span style={{ width: 10, height: 10, borderRadius: 999, background: colors[index % colors.length] }} />
                                {item.label}
                            </span>
                            <strong>{item.value}</strong>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="dashboard-header-left">
                    <Shield size={40} color="var(--primary-color)" />
                    <h1 style={{ fontSize: '2rem' }}>Panel de Administración</h1>
                </div>
                <div className="dashboard-header-right">
                    <ProfileAvatar user={user} size={42} />
                    <div className="user-badge">Admin: {user?.email}</div>
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

            <nav className="tabs-container">
                <div className={`tab-item ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>
                    <Users size={18} /> Usuarios
                </div>
                <div className={`tab-item ${activeTab === 'grupos' ? 'active' : ''}`} onClick={() => setActiveTab('grupos')}>
                    <LayoutGrid size={18} /> Clases / Materias
                </div>
                <div className={`tab-item ${activeTab === 'permisos' ? 'active' : ''}`} onClick={() => setActiveTab('permisos')}>
                    <Key size={18} /> Perfiles y Permisos
                </div>
                <div className={`tab-item ${activeTab === 'analiticas' ? 'active' : ''}`} onClick={() => setActiveTab('analiticas')}>
                    <BarChart3 size={18} /> Analíticas
                </div>
                <div className={`tab-item ${activeTab === 'auditoria' ? 'active' : ''}`} onClick={() => { setActiveTab('auditoria'); cargarAuditoria(); }}>
                    <FileText size={18} /> Auditoría y Logs
                </div>
            </nav>

            {loading ? <p>Cargando panel...</p> : (
                <>
                    {activeTab === 'usuarios' && (
                        <div className="glass-card">
                            <div className="card-header">
                                <h2 className="card-title"><Users size={24} color="var(--primary-color)" /> Usuarios</h2>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => { setEditingUser(null); setUserData({ email: '', password: '', id_rol: '' }); setShowUserModal(true); }} className="action-btn" style={{ background: 'var(--primary-color)', color: 'white' }}>
                                        <Plus size={18} /> Nuevo Usuario
                                    </button>
                                </div>
                            </div>
                            <div className="table-filter-row">
                                <input
                                    className="form-input"
                                    placeholder="Filtrar usuarios"
                                    value={tableFilters.usuarios}
                                    onChange={(e) => setTableFilter('usuarios', e.target.value)}
                                />
                            </div>
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <SortableHeader label="Email" sortKey="email" sort={usuariosSort} />
                                        <SortableHeader label="Perfil" sortKey="perfil" sort={usuariosSort} />
                                        <SortableHeader label="Estado" sortKey="estado" sort={usuariosSort} />
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usuariosPagination.pageItems.map(u => (
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
                                                <button onClick={() => verRolesUsuario(u)} className="action-btn" title="Ver cargos en aulas"><LayoutGrid size={16} /></button>
                                                <button onClick={() => eliminarUsuario(u.id)} className="action-btn danger" title="Eliminar"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsuarios.length === 0 && (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay usuarios para este filtro.</td></tr>
                                    )}
                                </tbody>
                            </table>
                            <TablePagination pagination={usuariosPagination} />
                        </div>
                    )}

                    {/* SECCIÓN GRUPOS */}
                    {activeTab === 'grupos' && (
                        <div className="glass-card">
                            <div className="card-header">
                                <h2 className="card-title"><LayoutGrid size={24} color="var(--primary-color)" /> Clases / Materias</h2>
                                <button onClick={() => setShowGroupModal(true)} className="action-btn" style={{ background: 'var(--primary-color)', color: 'white' }}>
                                    <Plus size={18} /> Crear Clase/Materia
                                </button>
                            </div>
                            <div className="table-filter-row">
                                <input
                                    className="form-input"
                                    placeholder="Filtrar clases"
                                    value={tableFilters.grupos}
                                    onChange={(e) => setTableFilter('grupos', e.target.value)}
                                />
                            </div>
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <SortableHeader label="Clase / Materia" sortKey="nombre" sort={gruposSort} />
                                        <SortableHeader label="Descripción" sortKey="descripcion" sort={gruposSort} />
                                        <SortableHeader label="Tutor/Profesor" sortKey="tutor" sort={gruposSort} />
                                        <SortableHeader label="Estado" sortKey="estado" sort={gruposSort} />
                                        <th>Miembros</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gruposPagination.pageItems.map(g => (
                                        <Fragment key={g.id}>
                                            <tr>
                                                <td style={{ fontWeight: 'bold' }}>
                                                    <button className="action-btn" onClick={() => toggleGrupoExpandido(g.id)} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem' }}>
                                                        {expandedGroupId === g.id ? '-' : '+'}
                                                    </button>
                                                    {g.nombre}
                                                </td>
                                                <td>{g.descripcion}</td>
                                                <td>{getGrupoTutorLabel(g) || 'Sin tutor'}</td>
                                                <td><span className={`status-badge ${g.activo ? 'status-active' : 'status-inactive'}`}>{g.activo ? 'Activo' : 'Inactivo'}</span></td>
                                                <td>
                                                    <button className="action-btn copy-btn" onClick={() => abrirGestionReBACAdmin(g)} title="Gestionar miembros">
                                                        <Users size={16} /> Gestionar miembros
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedGroupId === g.id && (
                                                <tr>
                                                    <td colSpan="5">
                                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>
                                                                Resumen de miembros actuales
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                {(groupContextRoles[g.id] || []).map(role => (
                                                                    <span key={role.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                        <ContextRoleBadge role={role.relacion} /> {role.email || `Usuario #${role.id_usuario}`}
                                                                    </span>
                                                                ))}
                                                                {(!groupContextRoles[g.id] || groupContextRoles[g.id].length === 0) && (
                                                                    <span style={{ color: 'var(--text-muted)' }}>Sin roles contextuales activos.</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                    {filteredAdminGroups.length === 0 && <tr><td colSpan="5" style={{textAlign: 'center', color: 'var(--text-muted)'}}>No hay clases/materias para este filtro.</td></tr>}
                                </tbody>
                            </table>
                            <TablePagination pagination={gruposPagination} />
                        </div>
                    )}

                    {activeTab === 'analiticas' && (
                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            <div className="glass-card">
                                <div className="card-header">
                                    <h2 className="card-title"><BarChart3 size={24} color="var(--primary-color)" /> Analíticas del sistema</h2>
                                    <button className="action-btn" onClick={cargarTodo}>
                                        <TrendingUp size={16} /> Actualizar
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                    {statCard('Usuarios activos', activeUsers, `${blockedUsers} bloqueados`, 'var(--primary-color)', <Users size={18} />)}
                                    {statCard('Sesiones activas', activeSessions, 'Conexiones abiertas', '#10b981', <Activity size={18} />)}
                                    {statCard('Acciones 24h', logStats.totalAcciones, `${logStats.consultasIA} consultas IA`, '#a78bfa', <BarChart3 size={18} />)}
                                    {statCard('Tasa de fallos', `${failureRate}%`, `${logStats.accionesFallidas} fallidas`, failureRate > 20 ? '#ef4444' : '#f59e0b', <AlertTriangle size={18} />)}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1.5rem' }}>
                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><BarChart3 size={20} color="#60a5fa" /> Actividad por día</h3>
                                    </div>
                                    {verticalBars(recentActivityData, maxRecentActivityCount, '#60a5fa')}
                                </div>

                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><TrendingUp size={20} color="#38bdf8" /> Tendencia semanal</h3>
                                    </div>
                                    {lineChart(recentActivityData, '#38bdf8')}
                                </div>

                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><PieChart size={20} color="var(--primary-color)" /> Usuarios por perfil</h3>
                                    </div>
                                    <div style={{ display: 'grid', gap: '1.2rem' }}>
                                        {stackedSegments(roleDistribution)}
                                        {barList(roleDistribution, maxRoleCount, 'var(--primary-color)')}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><LayoutGrid size={20} color="#10b981" /> Estado de clases</h3>
                                    </div>
                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                        {donut(groupStatusData[0].value, grupos.length, '#10b981', 'Clases activas')}
                                        {barList(groupStatusData, Math.max(...groupStatusData.map(item => item.value), 1), '#10b981')}
                                    </div>
                                </div>

                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><Activity size={20} color="#f97316" /> Acciones por tipo</h3>
                                    </div>
                                    {barList(actionTypeData, maxActionTypeCount, '#f97316')}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><Users size={20} color="#10b981" /> Usuarios con más actividad</h3>
                                    </div>
                                    {barList(topUsersData, maxTopUserCount, '#10b981')}
                                </div>

                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><Activity size={20} color="#f59e0b" /> Acciones por sección</h3>
                                    </div>
                                    {barList(actionSectionData, maxActionCount, '#f59e0b')}
                                </div>

                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><Bot size={20} color="#a78bfa" /> Uso IA y sesiones</h3>
                                    </div>
                                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                                        {donut(logStats.consultasIA, logStats.totalAcciones, '#a78bfa', 'Consultas IA 24h')}
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{aiShare}% de la actividad reciente corresponde a IA.</div>
                                        {barList(sessionDeviceData, Math.max(...sessionDeviceData.map(item => item.value), 1), '#60a5fa')}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><LayoutGrid size={20} color="#10b981" /> Resumen académico</h3>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.9rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Clases totales</span><strong>{grupos.length}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Clases activas</span><strong>{groupStatusData[0].value}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Promedio alumnos/clase</span><strong>{averageStudentsPerClass}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Profesores registrados</span><strong>{profesores.length}</strong></div>
                                    </div>
                                </div>

                                <div className="glass-card">
                                    <div className="card-header">
                                        <h3 className="card-title"><Shield size={20} color="#ef4444" /> Señales de seguridad</h3>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        {securitySignals.map(signal => (
                                            <div key={signal.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>{signal.label}</span>
                                                <strong style={{ color: signal.color }}>{signal.value}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {chartTooltip && (
                                <div
                                    style={{
                                        position: 'fixed',
                                        left: chartTooltip.x,
                                        top: chartTooltip.y,
                                        zIndex: 9999,
                                        minWidth: 150,
                                        padding: '0.75rem 0.85rem',
                                        borderRadius: 8,
                                        background: 'rgba(8, 13, 28, 0.96)',
                                        border: '1px solid var(--glass-border)',
                                        boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
                                        pointerEvents: 'none'
                                    }}
                                >
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800 }}>{chartTooltip.subtitle}</div>
                                    <div style={{ fontWeight: 800, marginTop: '0.2rem' }}>{chartTooltip.title}</div>
                                    <div style={{ color: '#60a5fa', fontSize: '1.4rem', fontWeight: 900, marginTop: '0.25rem' }}>{chartTooltip.value}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECCIÓN PERMISOS */}
                    {activeTab === 'permisos' && (
                        <>
                            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '4px solid var(--primary-color)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Perfiles</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>{roles.length}</div>
                                </div>
                                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '4px solid #10b981' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Perfiles Activos</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>{roles.filter(r => r.activo !== false).length}</div>
                                </div>
                                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Permisos Disponibles</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>{permisos.length}</div>
                                </div>
                                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px dashed var(--primary-color)', background: 'transparent' }} onClick={() => setShowRoleModal(true)}>
                                    <div style={{ textAlign: 'center', color: 'var(--primary-color)' }}>
                                        <Plus size={32} />
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>NUEVO PERFIL</div>
                                    </div>
                                </div>
                            </div>

                            {/* TABLA DE ROLES */}
                            <div className="glass-card" style={{ marginBottom: '2rem' }}>
                                <div className="card-header">
                                    <h3 className="card-title"><Shield size={20} color="var(--primary-color)" /> Perfiles del Sistema</h3>
                                </div>
                                <div className="table-filter-row">
                                    <input
                                        className="form-input"
                                        placeholder="Filtrar perfiles"
                                        value={tableFilters.roles}
                                        onChange={(e) => setTableFilter('roles', e.target.value)}
                                    />
                                </div>
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <SortableHeader label="Nombre" sortKey="nombre" sort={rolesSort} />
                                            <SortableHeader label="Descripción" sortKey="descripcion" sort={rolesSort} />
                                            <SortableHeader label="Tipo" sortKey="tipo" sort={rolesSort} />
                                            <SortableHeader label="Permisos" sortKey="permisos" sort={rolesSort} />
                                            <SortableHeader label="Estado" sortKey="estado" sort={rolesSort} />
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rolesPagination.pageItems.map(r => (
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
                                        {filteredRoles.length === 0 && (
                                            <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay perfiles para este filtro.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                                <TablePagination pagination={rolesPagination} />
                            </div>

                            <div className="glass-card permission-matrix-card">
                                <div className="card-header">
                                    <div>
                                        <h3 className="card-title"><LayoutGrid size={20} color="var(--primary-color)" /> Matriz Visual de Permisos</h3>
                                        <p style={{ margin: '0.45rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            Haz clic en una celda para activar o desactivar un permiso del perfil.
                                        </p>
                                    </div>
                                </div>

                                <div className="permission-matrix-wrap">
                                    <table className="permission-matrix">
                                        <thead>
                                            <tr>
                                                <th className="role-head" rowSpan="2">Perfiles / Permisos</th>
                                                {recursosPermisos.map(([recurso, permsEnGrupo]) => (
                                                    <th key={recurso} className="resource-head" colSpan={permsEnGrupo.length}>
                                                        {recurso}
                                                    </th>
                                                ))}
                                            </tr>
                                            <tr>
                                                {recursosPermisos.flatMap(([recurso, permsEnGrupo]) => (
                                                    permsEnGrupo.map(permiso => (
                                                        <th key={`${recurso}-${permiso.id}`} className="permission-head" title={permiso.descripcion || permiso.nombre}>
                                                            <span>{permiso.nombre}</span>
                                                        </th>
                                                    ))
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {roles.map(rol => (
                                                <tr key={rol.id}>
                                                    <th className="role-cell">
                                                        <strong>{rol.nombre}</strong>
                                                        <span>{rol.tipo || 'Sin tipo'}</span>
                                                    </th>
                                                    {recursosPermisos.flatMap(([, permsEnGrupo]) => (
                                                        permsEnGrupo.map(permiso => {
                                                            const tiene = permisoActivoEnRol(rol, permiso);
                                                            return (
                                                                <td key={`${rol.id}-${permiso.id}`} className={tiene ? 'permission-cell enabled' : 'permission-cell disabled'}>
                                                                    <button
                                                                        type="button"
                                                                        className="permission-toggle-cell"
                                                                        title={`${rol.nombre} / ${permiso.nombre}: ${tiene ? 'Activo' : 'Inactivo'}`}
                                                                        aria-label={`${tiene ? 'Desactivar' : 'Activar'} ${permiso.nombre} para ${rol.nombre}`}
                                                                        onClick={() => togglePermiso(rol.id, permiso.id, tiene)}
                                                                    >
                                                                        {tiene ? <CheckCircle size={18} /> : <X size={17} />}
                                                                    </button>
                                                                </td>
                                                            );
                                                        })
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                    {activeTab === 'auditoria' && (
                        <div className="glass-card">
                            <div className="card-header">
                                <h2 className="card-title"><FileText size={24} color="var(--primary-color)" /> Auditoría y Logs</h2>
                            </div>

                            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ padding: '1rem', borderLeft: '4px solid var(--primary-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Total 24h</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{logStats.totalAcciones}</div>
                                </div>
                                <div style={{ padding: '1rem', borderLeft: '4px solid #ef4444', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Fallidas</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{logStats.accionesFallidas}</div>
                                </div>
                                <div style={{ padding: '1rem', borderLeft: '4px solid #10b981', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Sesiones activas</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{logStats.sesionesActivas}</div>
                                </div>
                                <div style={{ padding: '1rem', borderLeft: '4px solid #a78bfa', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Consultas IA</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{logStats.consultasIA}</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                <select className="form-select" value={auditFilters.fecha} onChange={(e) => cambiarFiltroAuditoria('fecha', e.target.value)}>
                                    <option value="hoy">Hoy</option>
                                    <option value="semana">Última semana</option>
                                    <option value="mes">Último mes</option>
                                    <option value="todo">Todo</option>
                                </select>
                                <select className="form-select" value={auditFilters.categoria} onChange={(e) => cambiarFiltroAuditoria('categoria', e.target.value)}>
                                    <option value="">Todas las categorias</option>
                                    <option value="LOGIN">Login</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="PROFESOR">Profesor</option>
                                    <option value="ESTUDIANTE">Estudiante</option>
                                    <option value="IA">IA</option>
                                    <option value="PBAC">PBAC</option>
                                </select>
                                <select className="form-select" value={auditFilters.exito} onChange={(e) => cambiarFiltroAuditoria('exito', e.target.value)}>
                                    <option value="">Todos los estados</option>
                                    <option value="true">Exito</option>
                                    <option value="false">Fallido / denegado</option>
                                </select>
                                <select className="form-select" value={auditFilters.nivel} onChange={(e) => cambiarFiltroAuditoria('nivel', e.target.value)}>
                                    <option value="">Todos los niveles</option>
                                    <option value="info">Info</option>
                                    <option value="warning">Warning</option>
                                    <option value="danger">Danger</option>
                                </select>
                                <select className="form-select" value={auditFilters.id_usuario} onChange={(e) => cambiarFiltroAuditoria('id_usuario', e.target.value)}>
                                    <option value="">Todos los usuarios</option>
                                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                                </select>
                                <input className="form-input" placeholder="Buscar accion" value={auditFilters.accion} onChange={(e) => cambiarFiltroAuditoria('accion', e.target.value)} />
                            </div>

                            <div className="segmented-filter" style={{ marginBottom: '1.25rem' }}>
                                <button className={activeLogTab === 'acciones' ? 'active' : ''} onClick={() => setActiveLogTab('acciones')}>
                                    Logs de Acciones ({actionLogs.length})
                                </button>
                                <button className={activeLogTab === 'sesiones' ? 'active' : ''} onClick={() => setActiveLogTab('sesiones')}>
                                    Logs de Sesiones ({sessionLogs.length})
                                </button>
                                <button className={activeLogTab === 'legacy' ? 'active' : ''} onClick={() => setActiveLogTab('legacy')}>
                                    Auditoria Legacy ({auditLogs.length})
                                </button>
                            </div>

                            {activeLogTab === 'acciones' && (
                            <>
                            <h3 className="card-title" style={{ marginTop: '1rem' }}>Logs de Acciones</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <SortableHeader label="Fecha" sortKey="fecha" sort={actionLogsSort} />
                                            <SortableHeader label="Resultado" sortKey="resultado" sort={actionLogsSort} />
                                            <SortableHeader label="Sección" sortKey="seccion" sort={actionLogsSort} />
                                            <SortableHeader label="Acción" sortKey="accion" sort={actionLogsSort} />
                                            <SortableHeader label="Usuario" sortKey="usuario" sort={actionLogsSort} />
                                            <SortableHeader label="Cliente" sortKey="cliente" sort={actionLogsSort} />
                                            <SortableHeader label="Descripción" sortKey="descripcion" sort={actionLogsSort} />
                                            <th>Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {actionLogsPagination.pageItems.map(log => {
                                            const visual = actionVisual(log);
                                            return (
                                            <tr key={log.id} style={{ background: log.resultado === 'DENIED' || log.resultado === 'FAILED' ? 'rgba(239, 68, 68, 0.06)' : 'transparent' }}>
                                                <td>{formatLogDate(log.fecha_creacion)}</td>
                                                <td>
                                                    <span className={`status-badge ${log.resultado === 'DENIED' || log.resultado === 'FAILED' ? 'status-inactive' : 'status-active'}`}>
                                                        {log.resultado}
                                                    </span>
                                                </td>
                                                <td>{log.seccion}</td>
                                                <td>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: visual.color, fontWeight: 700 }}>
                                                        {visual.icon}
                                                        {log.accion}
                                                    </span>
                                                </td>
                                                <td>{log.usuario?.email || (log.id_usuario ? `Usuario #${log.id_usuario}` : 'Sistema')}</td>
                                                <td>{log.cliente ? `${log.cliente.navegador} / ${log.cliente.sistema_operativo}` : '-'}</td>
                                                <td>{log.descripcion}</td>
                                                <td><button className="action-btn" onClick={() => setSelectedAuditLog(log)}>Ver JSON</button></td>
                                            </tr>
                                        );})}
                                        {actionLogs.length === 0 && (
                                            <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No hay acciones para los filtros seleccionados.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <TablePagination pagination={actionLogsPagination} />
                            </>
                            )}

                            {activeLogTab === 'sesiones' && (
                            <>
                            <h3 className="card-title">Logs de Sesiones</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <SortableHeader label="Inicio" sortKey="inicio" sort={sessionLogsSort} />
                                            <SortableHeader label="Fin" sortKey="fin" sort={sessionLogsSort} />
                                            <SortableHeader label="Estado" sortKey="estado" sort={sessionLogsSort} />
                                            <SortableHeader label="Usuario" sortKey="usuario" sort={sessionLogsSort} />
                                            <SortableHeader label="Dispositivo" sortKey="dispositivo" sort={sessionLogsSort} />
                                            <SortableHeader label="Navegador" sortKey="navegador" sort={sessionLogsSort} />
                                            <SortableHeader label="IP" sortKey="ip" sort={sessionLogsSort} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sessionLogsPagination.pageItems.map(session => (
                                            <tr key={session.id}>
                                                <td>{formatLogDate(session.fecha_inicio)}</td>
                                                <td>{session.fecha_fin ? formatLogDate(session.fecha_fin) : '-'}</td>
                                                <td><span className={`status-badge ${session.estado === 'ACTIVA' ? 'status-active' : 'status-inactive'}`}>{session.estado}</span></td>
                                                <td>{session.usuario?.email || `Usuario #${session.id_usuario}`}</td>
                                                <td>{session.cliente?.dispositivo || '-'}</td>
                                                <td>{session.cliente ? `${session.cliente.navegador} / ${session.cliente.sistema_operativo}` : '-'}</td>
                                                <td>{session.ip_address || '-'}</td>
                                            </tr>
                                        ))}
                                        {sessionLogs.length === 0 && (
                                            <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay sesiones para los filtros seleccionados.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <TablePagination pagination={sessionLogsPagination} />

                            </>
                            )}

                            {activeLogTab === 'legacy' && (
                            <>
                            <h3 className="card-title">Auditoría Legacy</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <SortableHeader label="Fecha" sortKey="fecha" sort={auditLogsSort} />
                                            <SortableHeader label="Nivel" sortKey="nivel" sort={auditLogsSort} />
                                            <SortableHeader label="Sección" sortKey="seccion" sort={auditLogsSort} />
                                            <SortableHeader label="Acción" sortKey="accion" sort={auditLogsSort} />
                                            <SortableHeader label="Usuario" sortKey="usuario" sort={auditLogsSort} />
                                            <SortableHeader label="Descripción" sortKey="descripcion" sort={auditLogsSort} />
                                            <th>Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditLogsPagination.pageItems.map(log => (
                                            <tr key={log.id}>
                                                <td>{formatLogDate(log.fecha_creacion)}</td>
                                                <td>
                                                    <span className={`status-badge ${log.nivel === 'danger' ? 'status-inactive' : 'status-active'}`}>
                                                        {log.nivel}
                                                    </span>
                                                </td>
                                                <td>{log.seccion}</td>
                                                <td>{log.accion}</td>
                                                <td>{log.usuario?.email || (log.id_usuario ? `Usuario #${log.id_usuario}` : 'Sistema')}</td>
                                                <td>{log.descripcion}</td>
                                                <td>
                                                    <button className="action-btn" onClick={() => setSelectedAuditLog(log)}>
                                                        Ver JSON
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {auditLogs.length === 0 && (
                                            <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay logs para los filtros seleccionados.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <TablePagination pagination={auditLogsPagination} />
                            </>
                            )}
                        </div>
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
                                        <label className="form-label">Perfil / Tipo de cuenta</label>
                                        <select 
                                            className="form-select" 
                                            required 
                                            value={userData.id_rol} 
                                            onChange={(e) => setUserData({...userData, id_rol: e.target.value})}
                                        >
                                            <option value="">-- Selecciona un perfil --</option>
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
                                    <h2>Crear Nuevo Perfil</h2>
                                    <button onClick={() => setShowRoleModal(false)} className="action-btn"><X size={20} /></button>
                                </div>
                                <form onSubmit={crearRol}>
                                    <div className="form-group">
                                        <label className="form-label">Nombre del perfil</label>
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
                                        <label className="form-label">Tipo de perfil</label>
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
                                        Guardar Perfil
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

            {selectedAuditLog && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '760px' }}>
                        <div className="card-header">
                            <h2>Detalle de Auditoría</h2>
                            <button onClick={() => setSelectedAuditLog(null)} className="action-btn"><X size={20} /></button>
                        </div>
                        <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1rem', maxHeight: '420px', overflow: 'auto' }}>
                            {JSON.stringify(selectedAuditLog.metadata || {}, null, 2)}
                        </pre>
                    </div>
                </div>
            )}

            {rebacGroup && (
                <ReBACManagementModal
                    title={`Gestionar miembros: ${rebacGroup.nombre}`}
                    roles={groupContextRoles[rebacGroup.id] || []}
                    users={usuariosAsignables}
                    onClose={() => setRebacGroup(null)}
                    onAssign={asignarRolContextualAdmin}
                    onRevoke={revocarRolContextualAdmin}
                    assignableRoles={['director_grupo', 'profesor_materia', 'tutor_asistente', 'alumno']}
                    userLabel="Usuario"
                    userPlaceholder="Selecciona un usuario"
                    multiple
                />
            )}

            {selectedUserRoles && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '680px' }}>
                        <div className="card-header">
                            <h2>Cargos en aulas: {selectedUserRoles.usuario.email}</h2>
                            <button onClick={() => setSelectedUserRoles(null)} className="action-btn"><X size={20} /></button>
                        </div>
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Grupo</th>
                                    <th>Cargo</th>
                                    <th>Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedUserRoles.roles.map(role => (
                                    <tr key={role.id}>
                                        <td>{role.grupo_nombre}</td>
                                        <td><ContextRoleBadge role={role.relacion} /></td>
                                        <td>{role.fecha_creacion ? new Date(role.fecha_creacion).toLocaleDateString() : '-'}</td>
                                    </tr>
                                ))}
                                {selectedUserRoles.roles.length === 0 && (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Este usuario no tiene cargos activos en aulas.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Crear Grupo */}
            {showGroupModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="card-header"><h2>Crear Nueva Clase/Materia</h2><button onClick={() => setShowGroupModal(false)} className="action-btn"><X size={20} /></button></div>
                        <form onSubmit={crearGrupo}>
                            <div className="form-group">
                                <label className="form-label">Nombre de la clase/materia</label>
                                <input type="text" className="form-input" required placeholder="Ej: Matemáticas 101" onChange={(e) => setNewGroup({...newGroup, nombre: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descripción</label>
                                <input type="text" className="form-input" placeholder="Opcional" onChange={(e) => setNewGroup({...newGroup, descripcion: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Profesor titular</label>
                                <select className="form-select" required onChange={(e) => setNewGroup({...newGroup, id_profesor: e.target.value})}>
                                    <option value="">-- Elige un profesor --</option>
                                    {profesores.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="action-btn" style={{ background: 'var(--primary-color)', color: 'white', width: '100%' }}>Crear clase/materia</button>
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
