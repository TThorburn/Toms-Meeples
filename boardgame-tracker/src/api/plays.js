import { client } from './client'

export const playsApi = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.players) params.set('players', filters.players)
    if (filters.gameId) params.set('gameId', filters.gameId)
    const qs = params.toString()
    return client.get(`/plays${qs ? `?${qs}` : ''}`)
  },
  logPlay: (play) => client.post('/plays', play),
  deletePlay: (id) => client.delete(`/plays/${id}`),
}
