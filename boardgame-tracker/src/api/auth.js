import { client } from './client'

export const authApi = {
  login: (username, password) => client.post('/auth/login', { username, password }),
  register: (username, password) => client.post('/auth/register', { username, password }),
  me: () => client.get('/auth/me'),
  updateAccount: (data) => client.put('/auth/account', data),
  setupStatus: () => client.get('/auth/setup-status'),
  setup: (data) => client.post('/auth/setup', data),
  // Admin
  getUsers: () => client.get('/admin/users'),
  createUser: (data) => client.post('/admin/users', data),
  updateUser: (userId, data) => client.put(`/admin/users/${userId}`, data),
  resetPassword: (userId, newPassword) => client.post(`/admin/users/${userId}/reset-password`, { newPassword }),
}
