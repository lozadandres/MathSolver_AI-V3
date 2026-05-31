import '../styles/Dashboards.css';

const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

const resolveAvatarUrl = (avatarUrl) => {
    if (!avatarUrl) return null;
    if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
    return `${apiOrigin}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`;
};

const ProfileAvatar = ({ user, size = 44, className = '' }) => {
    const avatarSrc = resolveAvatarUrl(user?.avatarUrl);
    const initial = (user?.email || 'U').trim().charAt(0).toUpperCase();

    return (
        <div
            className={`profile-avatar ${className}`}
            style={{ width: size, height: size, minWidth: size, fontSize: Math.max(14, size * 0.42) }}
            aria-label={`Avatar de ${user?.email || 'usuario'}`}
        >
            {avatarSrc ? (
                <img src={avatarSrc} alt={`Avatar de ${user?.email || 'usuario'}`} />
            ) : (
                <span>{initial}</span>
            )}
        </div>
    );
};

export default ProfileAvatar;
