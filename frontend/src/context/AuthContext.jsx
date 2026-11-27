import { useState, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'
import { AuthContext } from './authContextDef'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user')
      return savedUser ? JSON.parse(savedUser) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token') || null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  // Verify stored token on mount
  useEffect(() => {
    let isMounted = true
    const verifyAuth = async () => {
      const savedToken = localStorage.getItem('token')
      if (!savedToken) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const response = await authAPI.getProfile()
        if (isMounted && response?.data) {
          setUser(response.data)
          localStorage.setItem('user', JSON.stringify(response.data))
        }
      } catch {
        // Token invalid or expired
        if (isMounted) {
          setUser(null)
          setToken(null)
          authAPI.logout()
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    verifyAuth()
    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const response = await authAPI.login({ email, password })
    if (response?.data?.token) {
      const { user: userData, token: userToken } = response.data
      setToken(userToken)
      setUser(userData)
      localStorage.setItem('token', userToken)
      localStorage.setItem('user', JSON.stringify(userData))
      return userData
    }
    throw new Error('Authentication failed. No token received.')
  }, [])

  const logout = useCallback(() => {
    authAPI.logout()
    setUser(null)
    setToken(null)
  }, [])

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
