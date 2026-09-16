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
  }) {
    return this.http.post<Game>(this.apiUrl, game);
  }

  deleteGame(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}