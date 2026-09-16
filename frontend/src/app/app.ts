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

  newGame = {
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
}