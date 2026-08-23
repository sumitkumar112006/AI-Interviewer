import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import PageLoading from '../../Shared/components/PageLoading'

const Protected = ({ children }) => {

    const { loading, user } = useAuth()

    if (loading) {
        return (<main><PageLoading title="Verifying Access..." subtitle="Checking security credentials..." /></main>)
    }

    if (!user) {
        return <Navigate to="/login" />
    }

    return children
}

export default Protected