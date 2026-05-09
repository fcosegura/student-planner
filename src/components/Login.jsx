import { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = '365692313483-g4tv5i5agl4egs67h980vn6ce977p7df.apps.googleusercontent.com';

function loadGoogleIdentity(callback) {
  if (window.google?.accounts?.id) {
    callback();
    return () => {};
  }
  const script = document.querySelector('script[src*="gsi/client"]');
  const onLoad = () => {
    if (window.google?.accounts?.id) callback();
  };
  if (script) {
    script.addEventListener('load', onLoad);
    // Script may have loaded before we subscribed.
    queueMicrotask(onLoad);
    return () => script.removeEventListener('load', onLoad);
  }
  let cancelled = false;
  const poll = window.setInterval(() => {
    if (cancelled) return;
    if (window.google?.accounts?.id) {
      window.clearInterval(poll);
      callback();
    }
  }, 50);
  return () => {
    cancelled = true;
    window.clearInterval(poll);
  };
}

export default function Login({ onLoginSuccess }) {
  const googleBtnRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const cleanupLoad = loadGoogleIdentity(() => {
      if (cancelled || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            setError('');
            await onLoginSuccess(response.credential);
          } catch {
            setError('No se pudo iniciar sesión. Revisa la configuración de Google/Cloudflare.');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with',
        shape: 'pill',
      });
    });
    return () => {
      cancelled = true;
      cleanupLoad();
    };
  }, [onLoginSuccess]);

  return (
    <div className="login-page">
      <div className="login-card">
        <div>
          <div className="login-mark">E</div>
          <h1>Student Planner Lite</h1>
          <p>
            Calendario y tablero para organizar estudio y entregas. Tus datos se sincronizan en la nube.
          </p>
        </div>

        <div className="login-actions">
          <div ref={googleBtnRef} style={{ width: '100%', minHeight: 44, display: 'flex', justifyContent: 'center' }}></div>
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}
        </div>

        <div className="login-note">
          Inicia sesión con Google para guardar en Cloudflare D1 de forma segura.
        </div>
      </div>
    </div>
  );
}
