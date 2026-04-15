import { client } from './client'

export const leaguesApi = {
  getAll: () => client.get('/leagues'),
  getById: (id) => client.get(`/leagues/${id}`),
  create: (data) => client.post('/leagues', data),
  join: (id) => client.post(`/leagues/${id}/join`),
  leave: (id) => client.delete(`/leagues/${id}/leave`),
  getLeaderboard: (id) => client.get(`/leagues/${id}/leaderboard`),
  getPlays: (id) => client.get(`/leagues/${id}/plays`),
  logPlay: (id, data) => client.post(`/leagues/${id}/plays`, data),
  getStats: (id) => client.get(`/leagues/${id}/stats`),
}
