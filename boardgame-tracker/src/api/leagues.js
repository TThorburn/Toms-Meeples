import { client } from './client'

export const leaguesApi = {
  getAll: () => client.get('/leagues'),
  getById: (id) => client.get(`/leagues/${id}`),
  join: (id) => client.post(`/leagues/${id}/join`),
  leave: (id) => client.delete(`/leagues/${id}/leave`),
  getLeaderboard: (id) => client.get(`/leagues/${id}/leaderboard`),
}
