import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './shared/Login.jsx'
import DriverHome from './driver/DriverHome.jsx'
import ActiveRoute from './driver/ActiveRoute.jsx'
import AdminMap from './admin/AdminMap.jsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/driver" element={<DriverHome />} />
      <Route path="/driver/route" element={<ActiveRoute />} />
      <Route path="/admin" element={<AdminMap />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default App