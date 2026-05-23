const roleConfig = {
    director_grupo: { label: 'Director', className: 'role-context-director' },
    profesor_materia: { label: 'Profesor', className: 'role-context-profesor' },
    tutor_asistente: { label: 'Tutor', className: 'role-context-tutor' },
    alumno: { label: 'Alumno', className: 'role-context-alumno' }
};

const ContextRoleBadge = ({ role }) => {
    const config = roleConfig[role] || { label: role, className: 'role-context-default' };
    return <span className={`context-role-badge ${config.className}`}>{config.label}</span>;
};

export default ContextRoleBadge;
