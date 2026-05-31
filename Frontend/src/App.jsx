import { RouterProvider } from 'react-router-dom'
import { router } from './app.routes.jsx'
import { AuthContext, AuthProvider } from './features/Auth/auth.context.jsx';
import { interviewContext, InterviewProvider } from './features/Interview/interview.context.jsx';



function App() {

  return (

    <AuthProvider>
      <InterviewProvider>
        <RouterProvider router={router} />
      </InterviewProvider>
    </AuthProvider>

  );
}

export default App;