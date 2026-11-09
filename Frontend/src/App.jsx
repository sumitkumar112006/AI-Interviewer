import { RouterProvider } from 'react-router-dom'
import { router } from './app.routes.jsx'
import { AuthProvider } from './features/Auth/auth.context.jsx';
import { InterviewProvider } from './features/Interview/interview.context.jsx';
import { ErrorBoundary, GlobalErrorOverlay } from './features/Shared/components/GlobalErrorOverlay';
import { AppConfigProvider } from './features/Shared/context/AppConfigContext.jsx';
import { Toaster } from 'sonner';

function App() {
  return (
    <ErrorBoundary>
      <AppConfigProvider>
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
      </AppConfigProvider>
    </ErrorBoundary>
  );
}

export default App;