import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { Game } from './game';
import { API_BASE } from './api';
import { Auth, GUEST_GAMES_KEY } from './services/auth';

export interface StoreLink {
  name: string;
  url: string;
}

export interface WhereToBuy {
  title: string;
  digital: StoreLink[];
  online: StoreLink[];
  nearby: StoreLink[];
  best_pc_deal: { price: string; store: string | null; url: string | null } | null;
}

export type GameInput = Omit<Game, 'id' | 'genre' | 'platform'> & {
  genre: string;
  platform: string;
};

@Injectable({
  providedIn: 'root'
})
export class GameService {

  private apiUrl = `${API_BASE}/games`;

  constructor(private http: HttpClient, private auth: Auth) {}

  // ----- GUEST LIBRARY (sessionStorage) -----

  private readGuestGames(): Game[] {
    try {
      return JSON.parse(sessionStorage.getItem(GUEST_GAMES_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private writeGuestGames(games: Game[]) {
    sessionStorage.setItem(GUEST_GAMES_KEY, JSON.stringify(games));
  }

  private guestError(status: number, detail: string) {
    return throwError(() => new HttpErrorResponse({ status, error: { detail } }));
  }

  // ----- LIBRARY -----

  getGames(): Observable<Game[]> {
    if (this.auth.isGuest()) {
      return of(this.readGuestGames());
    }

    return this.http.get<Game[]>(this.apiUrl);
  }

  addGame(game: GameInput): Observable<Game> {
    if (this.auth.isGuest()) {
      const games = this.readGuestGames();

      if (game.rawg_id != null && games.some(g => g.rawg_id === game.rawg_id)) {
        return this.guestError(409, 'Game already in library');
      }

      const newGame: Game = {
        ...game,
        id: Math.max(0, ...games.map(g => g.id)) + 1
      };

      this.writeGuestGames([...games, newGame]);
      return of(newGame);
    }

    return this.http.post<Game>(this.apiUrl, game);
  }

  deleteGame(id: number) {
    if (this.auth.isGuest()) {
      this.writeGuestGames(this.readGuestGames().filter(g => g.id !== id));
      return of({ message: 'Game deleted successfully' });
    }

    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  updateGame(id: number, game: GameInput): Observable<Game> {
    if (this.auth.isGuest()) {
      const games = this.readGuestGames();
      const index = games.findIndex(g => g.id === id);

      if (index === -1) {
        return this.guestError(404, 'Game not found');
      }

      const updated: Game = { ...game, id };
      games[index] = updated;
      this.writeGuestGames(games);
      return of(updated);
    }

    return this.http.put<Game>(`${this.apiUrl}/${id}`, game);
  }

  // ----- PUBLIC LOOKUPS -----

  searchGames(query: string) {
    return this.http.get<any[]>(`${this.apiUrl}/search`, {
      params: { query }
    });
  }

  getRandomGames() {
    return this.http.get<any[]>(`${this.apiUrl}/random`);
  }

  whereToBuy(title: string, rawgId: number | null) {
    let params = new HttpParams().set('title', title);

    if (rawgId) {
      params = params.set('rawg_id', rawgId);
    }

    return this.http.get<WhereToBuy>(`${this.apiUrl}/where-to-buy`, { params });
  }

}
