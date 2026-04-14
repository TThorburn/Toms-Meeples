import { client } from './client'

export const gamesApi = {
  // Returns { games: [{ id, name, yearPublished }] } — images come from detail call
  search: (q) => client.get(`/games/search?q=${encodeURIComponent(q)}`),
  // Returns full game object with image, stats, description etc.
  getById: (id) => client.get(`/games/${id}`),
}
