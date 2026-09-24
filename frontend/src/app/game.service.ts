import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Game } from './game';

@Injectable({
  providedIn: 'root'
})
export class GameService {

  private apiUrl = 'http://localhost:8000/api/games';

  constructor(private http: HttpClient) {}

  getGames() {
    return this.http.get<Game[]>(this.apiUrl);
  }

  addGame(game: {
    title: string;
    genre: string;
    platform: string;
    release_date: string;
    rating: number | null;
    image: string | null;
    rawg_id: number | null;
    favorite: boolean;
  }) {
    return this.http.post<Game>(this.apiUrl, game);
  }

  deleteGame(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  updateGame(
  id: number,
  game: {
    title: string;
    genre: string;
    platform: string;
    release_date: string | null;
    rating: number | null;
    image: string | null;
    rawg_id: number | null;
    favorite: boolean;

  }
) {
  return this.http.put<Game>(`${this.apiUrl}/${id}`, game);
}

searchGames(query: string) {
  return this.http.get<any[]>(
    `http://localhost:8000/api/games/search?query=${encodeURIComponent(query)}`
  );
}

}