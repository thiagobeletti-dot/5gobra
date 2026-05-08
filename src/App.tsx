import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import Obras from './pages/Obras'
import Obra from './pages/Obra'
import ObraCliente from './pages/ObraCliente'
import ObraTecnico from './pages/ObraTecnico'
import Ajuda from './pages/Ajuda'
import Configuracoes from './pages/Configuracoes'
import Termos from './pages/Termos'
import Privacidade from './pages/Privacidade'
import RotaProtegida from './components/RotaProtegida'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/app" element={<Navigate to="/app/obras" replace />} />
          <Route
            path="/app/obras"
            element={
              <RotaProtegida>
                <Obras />
              </RotaProtegida>
            }
          />
          <Route
            path="/app/ajuda"
            element={
              <RotaProtegida>
                <Ajuda />
              </RotaProtegida>
            }
          />
          <Route
            path="/app/configuracoes"
            element={
              <RotaProtegida>
                <Configuracoes />
              </RotaProtegida>
            }
          />
          <Route path="/app/demo" element={
            <ErrorBoundary contexto="Houve um erro carregando a obra demo. Tenta recarregar.">
              <Obra />
            </ErrorBoundary>
          } />
          <Route
            path="/app/obra/:obraId"
            element={
              <RotaProtegida>
                <ErrorBoundary contexto="Houve um erro carregando essa obra. Tenta recarregar — se persistir me manda print dessa mensagem.">
                  <Obra />
                </ErrorBoundary>
              </RotaProtegida>
            }
          />
          <Route path="/obra/:token" element={
            <ErrorBoundary contexto="Houve um erro carregando essa obra. Tenta recarregar.">
              <ObraCliente />
            </ErrorBoundary>
          } />
          <Route path="/tec/:token" element={
            <ErrorBoundary contexto="Houve um erro carregando essa obra. Tenta recarregar.">
              <ObraTecnico />
            </ErrorBoundary>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
