import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import ContextRoleBadge from './ContextRoleBadge';

const roleOptions = [
    { value: 'director_grupo', label: 'Director de grupo' },
    { value: 'profesor_materia', label: 'Profesor de materia' },
    { value: 'tutor_asistente', label: 'Tutor asistente' },
    { value: 'alumno', label: 'Alumno' }
];

const ReBACManagementModal = ({
    title,
    roles = [],
    users = [],
    onClose,
    onAssign,
    onRevoke,
    canManage = true,
    assignableRoles = ['director_grupo', 'profesor_materia', 'tutor_asistente'],
    multiple = false,
    userLabel = 'Profesor',
    userPlaceholder = 'Selecciona un profesor'
}) => {
    const defaultRoles = assignableRoles.includes('profesor_materia') ? ['profesor_materia'] : [assignableRoles[0]].filter(Boolean);
    const [formData, setFormData] = useState({ id_usuario: '', relacion: 'profesor_materia', relaciones: defaultRoles });

    const handleSubmit = async (e) => {
        e.preventDefault();
        await onAssign(multiple ? { id_usuario: formData.id_usuario, relaciones: formData.relaciones, sync: true } : formData);
        setFormData({ id_usuario: '', relacion: 'profesor_materia', relaciones: defaultRoles });
    };

    const groupedRoles = multiple
        ? Object.values(roles.reduce((acc, role) => {
            const key = role.id_usuario || role.email || role.id;
            if (!acc[key]) {
                acc[key] = {
                    id_usuario: role.id_usuario,
                    email: role.email,
                    roles: [],
                    fecha_creacion: role.fecha_creacion
                };
            }
            acc[key].roles.push(role);
            return acc;
        }, {}))
        : roles;

    const toggleRole = (role) => {
        const exists = formData.relaciones.includes(role);
        setFormData({
            ...formData,
            relaciones: exists
                ? formData.relaciones.filter(item => item !== role)
                : [...formData.relaciones, role]
        });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '760px' }}>
                <div className="card-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="action-btn"><X size={20} /></button>
                </div>

                {canManage && (
                    <form onSubmit={handleSubmit} className="rebac-form">
                        <div className="form-group">
                            <label className="form-label">{userLabel}</label>
                            <select className="form-input" required value={formData.id_usuario} onChange={e => setFormData({ ...formData, id_usuario: e.target.value })}>
                                <option value="">{userPlaceholder}</option>
                                {users.map(u => <option key={u.id || u.id_usuario || u.email} value={u.id || u.id_usuario}>{u.email}</option>)}
                            </select>
                        </div>
                        {multiple ? (
                            <div className="form-group">
                                <label className="form-label">Roles contextuales</label>
                                <div className="rebac-checkbox-grid">
                                    {roleOptions.filter(role => assignableRoles.includes(role.value)).map(role => (
                                        <label key={role.value} className="rebac-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={formData.relaciones.includes(role.value)}
                                                onChange={() => toggleRole(role.value)}
                                            />
                                            {role.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="form-group">
                                <label className="form-label">Rol contextual</label>
                                <select className="form-input" required value={formData.relacion} onChange={e => setFormData({ ...formData, relacion: e.target.value })}>
                                    {roleOptions.filter(role => assignableRoles.includes(role.value)).map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                                </select>
                            </div>
                        )}
                        <button type="submit" className="action-btn rebac-submit">
                            <Plus size={16} /> {multiple ? 'Guardar roles' : 'Asignar rol'}
                        </button>
                    </form>
                )}

                <div style={{ overflowX: 'auto' }}>
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Rol contextual</th>
                                <th>Fecha</th>
                                {canManage && <th>Acciones</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {multiple ? groupedRoles.map(userRoles => (
                                <tr key={userRoles.id_usuario || userRoles.email}>
                                    <td>{userRoles.email || `Usuario #${userRoles.id_usuario}`}</td>
                                    <td style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        {userRoles.roles.map(role => <ContextRoleBadge key={role.id || role.id_relacion || `${role.id_usuario}-${role.relacion}`} role={role.relacion} />)}
                                    </td>
                                    <td>{userRoles.fecha_creacion ? new Date(userRoles.fecha_creacion).toLocaleDateString() : '-'}</td>
                                    {canManage && (
                                        <td style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                            {userRoles.roles
                                                .filter(role => !(role.relacion === 'alumno' && String(role.id || role.id_relacion).startsWith('alumno-')))
                                                .map(role => (
                                                    <button key={role.id || role.id_relacion} onClick={() => onRevoke(role.id || role.id_relacion)} className="action-btn danger" title={`Revocar ${role.relacion}`}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                ))}
                                        </td>
                                    )}
                                </tr>
                            )) : roles.map(role => (
                                <tr key={role.id || role.id_relacion || `${role.id_usuario}-${role.relacion}`}>
                                    <td>{role.email || `Usuario #${role.id_usuario}`}</td>
                                    <td><ContextRoleBadge role={role.relacion} /></td>
                                    <td>{role.fecha_creacion ? new Date(role.fecha_creacion).toLocaleDateString() : '-'}</td>
                                    {canManage && (
                                        <td>
                                            {!(role.relacion === 'alumno' && String(role.id || role.id_relacion).startsWith('alumno-')) ? (
                                                <button onClick={() => onRevoke(role.id || role.id_relacion)} className="action-btn danger" title="Revocar">
                                                    <Trash2 size={16} />
                                                </button>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Inscrito</span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {roles.length === 0 && (
                                <tr><td colSpan={canManage ? '4' : '3'} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay roles contextuales asignados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReBACManagementModal;
