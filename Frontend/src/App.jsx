import { RouterProvider } from 'react-router-dom'
import { router } from './app.routes.jsx'
import { AuthProvider } from './features/Auth/auth.context.jsx';
import { InterviewProvider } from './features/Interview/interview.context.jsx';
import { ErrorBoundary, GlobalErrorOverlay } from './features/Shared/components/GlobalErrorOverlay';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <InterviewProvider>
          <RouterProvider router={router} />
          <GlobalErrorOverlay />
        </InterviewProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;