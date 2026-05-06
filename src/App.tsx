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
import RotaProtegida from './components/RotaProtegida'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
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
          <Route path="/app/demo" element={<Obra />} />
          <Route
            path="/app/obra/:obraId"
            element={
              <RotaProtegida>
                <Obra />
              </RotaProtegida>
            }
          />
          <Route path="/obra/:token" element={<ObraCliente />} />
          <Route path="/tec/:token" element={<ObraTecnico />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
