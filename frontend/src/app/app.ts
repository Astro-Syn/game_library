import { Component, signal } from '@angular/core';
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

  games: Game[] = [];
  searchResults: any[] = [];
  searchQuery = '';


  newGame = {
    title: '',
    genre: '',
    platform: ''
  };


  editingGameId: number | null = null;

editGame = {
  title: '',
  genre: '',
  platform: ''
};

  constructor(private gameService: GameService) {}

  getGames() {
  this.gameService.getGames()
    .subscribe(response => {
      this.games = response;
    });
}

  addGame() {
  this.gameService.addGame(this.newGame)
    .subscribe(response => {
      this.games.push(response);

      this.newGame = {
        title: '',
        genre: '',
        platform: ''
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
    platform: game.platform ?? ''
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
    platform: ''
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
    genre: '',
    platform: ''
  };

  this.gameService.addGame(newGame)
  .subscribe(response => {
    this.games.push(response)
  })
}
}