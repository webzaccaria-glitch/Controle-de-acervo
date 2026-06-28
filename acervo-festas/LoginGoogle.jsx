import { useState } from 'react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { verificarAcesso } from './auth'
import { jwtDecode } from 'jwt-decode'

const GOOGLE_CLIENT_ID = '239442392621-adsev5o9nhsd7u0g652s2tagirlvlddb.apps.googleusercontent.com'

export default function LoginGoogle({ onLoginSucesso }) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin(credentialResponse) {
    setCarregando(true)
    setErro('')
    try {
      const decoded = jwtDecode(credentialResponse.credential)
      const email = decoded.email
      const nome = decoded.name
      const foto = decoded.picture
      const temAcesso = await verificarAcesso(email)
      if (temAcesso) {
        onLoginSucesso({ email, nome, foto })
      } else {
        setErro('Acesso não autorizado. Entre em contato: (21) 97720-5575')
      }
    } catch (error) {
      setErro('Erro ao verificar acesso. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        fontFamily: 'sans-serif',
      }}>
        <div style={{
          background: 'white', borderRadius: '16px', padding: '48px 40px',
          textAlign: 'center', maxWidth: '400px', width: '90%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: '48px' }}>✨</span>
          <h1 style={{ margin: '8px 0 4px', fontSize: '22px', fontWeight: '700', color: '#1a1a2e' }}>
            Sonho dos Painéis
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>Controle de Acervo</p>
          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '24px 0' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: '#333' }}>
            Acesso ao Sistema
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#666', lineHeight: '1.5' }}>
            Entre com o email utilizado na compra.
          </p>
          {carregando ? (
            <div style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
              Verificando acesso... ⏳
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleLogin}
                onError={() => setErro('Erro ao fazer login. Tente novamente.')}
                text="signin_with" shape="rectangular" size="large" locale="pt-BR"
              />
            </div>
          )}
          {erro && (
            <div style={{
              marginTop: '20px', padding: '12px 16px', background: '#fff5f5',
              border: '1px solid #fed7d7', borderRadius: '8px',
              color: '#c53030', fontSize: '13px', lineHeight: '1.5',
            }}>
              ❌ {erro}
            </div>
          )}
          <p style={{ marginTop: '32px', fontSize: '12px', color: '#aaa' }}>
            Problemas? Chama no WhatsApp:<br />
            <a href="https://wa.me/5521977205575"
              style={{ color: '#25D366', textDecoration: 'none', fontWeight: '600' }}
              target="_blank" rel="noreferrer">
              (21) 97720-5575
            </a>
          </p>
        </div>
      </div>
    </GoogleOAuthProvider>
  )
}
