import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  protected readonly title = signal('Game Library');

  games: any[] = [];

  constructor(private http: HttpClient) {}

  getGames() {
    this.http.get<any[]>('http://localhost:8000/api/games')
      .subscribe(response => {
        this.games = response;
        console.log(this.games);
      });
  }
}