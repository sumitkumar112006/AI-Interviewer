import { RouterProvider } from 'react-router-dom'
import { router } from './app.routes.jsx'
import { AuthProvider } from './features/Auth/auth.context.jsx';
import { InterviewProvider } from './features/Interview/interview.context.jsx';
import { ErrorBoundary, GlobalErrorOverlay } from './features/Shared/components/GlobalErrorOverlay';
import { Toaster } from 'sonner';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <InterviewProvider>
          <RouterProvider router={router} />
          <GlobalErrorOverlay />
          <Toaster 
            position="bottom-right" 
            theme="dark" 
            duration={2500}
          />
        </InterviewProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;