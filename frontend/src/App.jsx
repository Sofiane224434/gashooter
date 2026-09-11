import { Routes, Route, Navigate } from 'react-router-dom';
import GameMenu from './pages/GameMenu.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<GameMenu />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
export default App;