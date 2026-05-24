import { RouterProvider } from 'react-router-dom'
import { router } from './app.routes.jsx'
import { AuthContext, AuthProvider } from './features/Auth/auth.context.jsx';
function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>

  );
}

export default App;