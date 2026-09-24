import { Component, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Game } from './game';
import { GameService } from './game.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  protected readonly title = signal('Game Library');

  toggleGameInfo(id: number) {
  if (this.expandedGameId === id) {
    this.expandedGameId = null;
  } else {
    this.expandedGameId = id;
  }
}

  games: Game[] = [];
  expandedGameId: number | null = null;
  searchResults: any[] = [];
  searchQuery = '';
  librarySearchQuery = '';
  libraryPlatformFilter = '';
  librarySort = '';
  libraryGenreFilter = '';


  get libraryPlatforms(): string[] {
  return [...new Set(
    this.games
      .map(game => game.platform)
      .filter((platform): platform is string => !!platform)
  )];
}

get libraryGenres(): string[] {
  const genres = this.games
    .flatMap(game =>
      game.genre
        ? game.genre.split(',').map(genre => genre.trim())
        : []
    );

  return [...new Set(genres)];
}



  newGame = {
    title: '',
    genre: '',
    platform: '',
    release_date: '',
    rating: null as number | null,
    image: '',
    rawg_id: null as number | null
  };


  editingGameId: number | null = null;

editGame = {
  title: '',
  genre: '',
  platform: '',
  release_date: null as string | null,
  rating: null as number | null,
  image: null as string | null,
  rawg_id: null as number | null

};

  constructor(private gameService: GameService) {}

  getGames() {
  this.gameService.getGames()
    .subscribe(response => {
      this.games = response;
    });
}


get filteredGames(): Game[] {
  const query = this.librarySearchQuery.trim().toLowerCase();

  let filtered = this.games.filter(game => {

    const matchesSearch =
      !query ||
      game.title.toLowerCase().includes(query);

    const matchesPlatform =
      !this.libraryPlatformFilter ||
      game.platform === this.libraryPlatformFilter;

      const matchesGenre =
  !this.libraryGenreFilter ||
  game.genre?.split(',').map(genre => genre.trim()).includes(this.libraryGenreFilter);

    return matchesSearch && matchesPlatform && matchesGenre;
  });

  if (this.librarySort === 'rating-desc') {
    filtered = [...filtered].sort(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
    );
  }

  if (this.librarySort === 'rating-asc') {
    filtered = [...filtered].sort(
      (a, b) => (a.rating ?? 0) - (b.rating ?? 0)
    );
  }

  if (this.librarySort === 'title-asc') {
    filtered = [...filtered].sort(
      (a, b) => a.title.localeCompare(b.title)
    );
  }

  if (this.librarySort === 'title-desc') {
    filtered = [...filtered].sort(
      (a, b) => b.title.localeCompare(a.title)
    );
  }

  return filtered;
}

  addGame() {
  this.gameService.addGame(this.newGame)
    .subscribe(response => {
      this.games.push(response);

      this.newGame = {
        title: '',
        genre: '',
        platform: '',
        release_date: '',
        rating: null,
        image: '',
        rawg_id: null 
        
      };
    });
}

  deleteGame(id: number) {
  this.gameService.deleteGame(id)
    .subscribe(() => {
      this.games = this.games.filter(game => game.id !== id);
    });
}

startEditing(game: Game) {
  this.editingGameId = game.id;

 this.editGame = {
  title: game.title,
  genre: game.genre ?? '',
  platform: game.platform ?? '',
  release_date: game.release_date,
  rating: game.rating,
  image: game.image,
  rawg_id: game.rawg_id
};
}

updateGame(id: number) {
  this.gameService.updateGame(id, this.editGame)
    .subscribe(response => {

      const index = this.games.findIndex(game => game.id === id);

      if (index !== -1) {
        this.games[index] = response;
      }

      this.cancelEditing();
    });
}

cancelEditing() {
  this.editingGameId = null;

  this.editGame = {
  title: '',
  genre: '',
  platform: '',
  release_date: null,
  rating: null,
  image: null,
  rawg_id: null
};
}

searchGames() {
  if (!this.searchQuery.trim()) {
    this.searchResults = [];
    return;
  }

  this.gameService.searchGames(this.searchQuery)
    .subscribe(response => {
      this.searchResults = response;
    });
}

addToLibrary(game: any) {
  const newGame = {
    title: game.title,
    genre: game.genre,
    platform: '',
    release_date: game.release_date,
    rating: game.rating,
    image: game.image,
    rawg_id: game.rawg_id
  };

  this.gameService.addGame(newGame)
    .subscribe({
      next: response => {
        this.games.push(response);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 409) {
          alert('This game is already in your library!');
        }
      }
    });
}
}