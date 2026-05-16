import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Calculator, Lock, Mail, UserPlus, ArrowRight, User } from 'lucide-react';

const RegisterView = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('Estudiante');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setIsSubmitting(true);
        
        const result = await register(email, password, role);
        
        if (result.success) {
            // Mostrar éxito en el login u obviar estado complejo y solo redirigir
            navigate('/login');
        } else {
            setError(result.error);
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-gradient)',
            fontFamily: '"Inter", sans-serif',
            color: 'var(--text-main)',
            overflow: 'hidden',
            position: 'relative',
            padding: '2rem 0'
        }}>
            {/* Elementos decorativos de fondo */}
            <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
            <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(60px)', borderRadius: '50%' }}></div>

            <div style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '24px',
                padding: '3rem 2.5rem',
                width: '100%',
                maxWidth: '420px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)', padding: '1rem', borderRadius: '16px', marginBottom: '1rem', boxShadow: '0 10px 20px -5px rgba(16,185,129,0.4)' }}>
                        <UserPlus size={32} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--text-heading)' }}>
                        Crea tu Cuenta
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Únete a MathSolver AI</p>
                </div>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '4px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: '500' }}>Rol en la Plataforma</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <User size={18} />
                            </div>
                            <select 
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: 'var(--input-bg)', border: '1px solid var(--btn-border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', appearance: 'none', boxSizing: 'border-box'
                                }}
                            >
                                <option value="Estudiante" style={{color: 'black'}}>Estudiante</option>
                                <option value="Profesor" style={{color: 'black'}}>Profesor</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: '500' }}>Correo Electrónico</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <Mail size={18} />
                            </div>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="tu@correo.edu"
                                style={{
                                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: 'var(--input-bg)', border: '1px solid var(--btn-border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--btn-border)'}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: '500' }}>Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <Lock size={18} />
                            </div>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                minLength="6"
                                style={{
                                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: 'var(--input-bg)', border: '1px solid var(--btn-border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--btn-border)'}
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: '500' }}>Confirmar Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <Lock size={18} />
                            </div>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                style={{
                                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: 'var(--input-bg)', border: '1px solid var(--btn-border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--btn-border)'}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        style={{
                            marginTop: '0.5rem', width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '600', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)', opacity: isSubmitting ? 0.7 : 1
                        }}
                    >
                        {isSubmitting ? 'Creando cuenta...' : 'Registrarse'}
                        {!isSubmitting && <ArrowRight size={18} />}
                    </button>
                    
                    <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                        ¿Ya tienes cuenta? <Link to="/login" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '500' }}>Inicia sesión aquí</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default RegisterView;
