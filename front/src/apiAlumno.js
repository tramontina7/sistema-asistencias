import axios from 'axios'

const apiAlumno = axios.create({
  baseURL: '/api',
})

apiAlumno.interceptors.request.use((config) => {
  const token = localStorage.getItem('alumno_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiAlumno.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('alumno_token')
      localStorage.removeItem('alumno_data')
      window.location.href = '/alumno/login'
    }
    return Promise.reject(err)
  }
)

export default apiAlumno
