import React from 'react'
import { useAuth } from '../../Auth/hooks/useAuth'
import LoadingPage from '../../Interview/Loading'

const Profile = () => {

    const{user, loading} = useAuth()

    if(loading) {
        return (<main>
            <LoadingPage />
        </main>)
    }

    if(!user) {
        return (
            <p> Please login to view your profile</p>
        )
    }
  return (
    <div>
        <h1>Profile</h1>
        <p>Username: {user.username}</p>
        <p>Email: {user.email}</p>
    </div>
  )
}

export default Profile