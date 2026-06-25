import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import LocationPicker from './pages/LocationPicker'
import StoreSearch from './pages/StoreSearch'
import Results from './pages/Results'
import ShoppingList from './pages/ShoppingList'

function RequireAuth({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<LocationPicker />} />
        <Route path="/stores" element={<StoreSearch />} />
        <Route path="/results" element={<Results />} />
        <Route path="/list" element={<RequireAuth><ShoppingList /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  )
}
