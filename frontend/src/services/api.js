import axios from 'axios'

// Centralized Axios instance
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// Request Interceptor: Attach JWT Token if available
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // Handle environments where localStorage might be restricted
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response Interceptor: Centralized error handling & token expiry detection
apiClient.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const errorResponse = {
      message: 'An unexpected error occurred. Please try again.',
      status: error.response ? error.response.status : null,
      errors: error.response?.data?.errors || null,
      raw: error,
    }

    if (error.response) {
      // Backend sent custom error message
      errorResponse.message =
        error.response.data?.message ||
        `Request failed with status ${error.response.status}`

      // Handle 401 Unauthorized (token expired or invalid)
      if (error.response.status === 401) {
        try {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        } catch {
          // Ignore storage errors
        }
      }
    } else if (error.request) {
      // Network error or server unreachable
      errorResponse.message =
        'Cannot connect to server. Please check your network connection.'
    } else {
      errorResponse.message = error.message
    }

    return Promise.reject(errorResponse)
  },
)

// Export Modular API Services
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  getProfile: () => apiClient.get('/auth/me'),
  getAllUsers: () => apiClient.get('/auth/users'),
  logout: () => {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    } catch {
      // Ignore storage errors
    }
  },
}

export const roomAPI = {
  getRooms: (params) => apiClient.get('/rooms', { params }),
  getRoomTypes: () => apiClient.get('/rooms/types'),
  getRoomById: (id) => apiClient.get(`/rooms/${id}`),
  createRoom: (data) => apiClient.post('/rooms', data),
  updateRoom: (id, data) => apiClient.put(`/rooms/${id}`, data),
  deleteRoom: (id) => apiClient.delete(`/rooms/${id}`),
}

export const reservationAPI = {
  getReservations: (params) => apiClient.get('/reservations', { params }),
  getReservationById: (id) => apiClient.get(`/reservations/${id}`),
  getAvailableRooms: (params) => apiClient.get('/reservations/available-rooms', { params }),
  createReservation: (data) => apiClient.post('/reservations', data),
  updateReservation: (id, data) => apiClient.put(`/reservations/${id}`, data),
  updateStatus: (id, status) =>
    apiClient.patch(`/reservations/${id}/status`, { status }),
  deleteReservation: (id) => apiClient.delete(`/reservations/${id}`),
}

export const guestAPI = {
  getGuests: (params) => apiClient.get('/guests', { params }),
  getGuestById: (id) => apiClient.get(`/guests/${id}`),
  getGuestHistory: (id) => apiClient.get(`/guests/${id}/history`),
  createGuest: (data) => apiClient.post('/guests', data),
  updateGuest: (id, data) => apiClient.put(`/guests/${id}`, data),
  deleteGuest: (id) => apiClient.delete(`/guests/${id}`),
}

export const checkInOutAPI = {
  checkIn: (data) => apiClient.post('/check-in-out/check-in', data),
  checkOut: (data) => apiClient.post('/check-in-out/check-out', data),
  getStatus: (reservationId) => apiClient.get(`/check-in-out/${reservationId}`),
  getActiveStays: (params) => apiClient.get('/check-in-out/active', { params }),
  getEligible: (params) => apiClient.get('/check-in-out/eligible', { params }),
  getHistory: (params) => apiClient.get('/check-in-out/history', { params }),
  getSummary: () => apiClient.get('/check-in-out/summary'),
}

export const paymentAPI = {
  getAllPayments: (params) => apiClient.get('/payments', { params }),
  getPaymentStats: () => apiClient.get('/payments/stats'),
  getPendingReservations: (params) => apiClient.get('/payments/pending-reservations', { params }),
  getPaymentById: (id) => apiClient.get(`/payments/${id}`),
  createPayment: (data) => apiClient.post('/payments', data),
  processRefund: (id, data) => apiClient.post(`/payments/${id}/refund`, data),
  getPaymentsByReservation: (reservationId) =>
    apiClient.get(`/payments/reservation/${reservationId}`),
}

export const invoiceAPI = {
  getAllInvoices: (params) => apiClient.get('/invoices', { params }),
  getInvoiceStats: () => apiClient.get('/invoices/stats'),
  getEligibleReservations: (params) =>
    apiClient.get('/invoices/eligible-reservations', { params }),
  getInvoiceById: (id) => apiClient.get(`/invoices/${id}`),
  generateInvoice: (data) => apiClient.post('/invoices/generate', data),
  getInvoiceByReservation: (reservationId) =>
    apiClient.get(`/invoices/reservation/${reservationId}`),
  updateStatus: (id, paymentStatus) =>
    apiClient.patch(`/invoices/${id}/status`, { paymentStatus }),
}

export const expenseAPI = {
  getExpenses: (params) => apiClient.get('/expenses', { params }),
  getStats: () => apiClient.get('/expenses/stats'),
  getReports: (params) => apiClient.get('/expenses/reports', { params }),
  getExpenseById: (id) => apiClient.get(`/expenses/${id}`),
  createExpense: (data) => apiClient.post('/expenses', data),
  updateExpense: (id, data) => apiClient.put(`/expenses/${id}`, data),
  deleteExpense: (id) => apiClient.delete(`/expenses/${id}`),
  getSummary: () => apiClient.get('/expenses/summary'),
}

export const staffAPI = {
  getStaff: () => apiClient.get('/staff'),
  createStaff: (data) => apiClient.post('/staff', data),
  updateStaff: (id, data) => apiClient.put(`/staff/${id}`, data),
}

export const healthAPI = {
  checkHealth: () => apiClient.get('/health'),
}

export default apiClient
