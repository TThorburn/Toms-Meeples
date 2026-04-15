import { client } from './client'

export const authApi = {
  login: (username, password) =>
    client.post('/auth/login', { username, password }),

  register: (username, password) =>
    client.post('/auth/register', { username, password }),

  me: () => client.get('/auth/me'),

  updateAccount: (data) => client.put('/auth/account', data),
}