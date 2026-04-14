import { client } from './client'

export const wishlistApi = {
  getAll: () => client.get('/wishlist'),
  add: (gameId, gameData = {}) => client.post('/wishlist', { gameId, ...gameData }),
  remove: (gameId) => client.delete(`/wishlist/${gameId}`),
}
