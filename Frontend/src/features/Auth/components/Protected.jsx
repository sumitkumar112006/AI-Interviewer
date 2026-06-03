import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router'
import LoadingPage from '../../Interview/Loading'

const Protected = ({children}) => {

    const { loading, user } = useAuth()
    
    if (loading) {
        return (<main><LoadingPage /></main>)
    }

    if (!user) {
        return <Navigate to="/login" />
    }

  return children
}

export default Protected