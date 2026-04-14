import { client } from './client'

export const libraryApi = {
  getAll: () => client.get('/library'),
  add: (gameId, gameData = {}) => client.post('/library', { gameId, ...gameData }),
  remove: (gameId) => client.delete(`/library/${gameId}`),
}
