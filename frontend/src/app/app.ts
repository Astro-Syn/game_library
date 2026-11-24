import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Game } from './game';
import { GameService, WhereToBuy } from './game.service';
import { MatIconModule } from '@angular/material/icon';
import { Login } from './login/login';
import { Auth } from './services/auth';
import { Subscription } from 'rxjs';
import { Register } from './register/register';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule, MatIconModule, Login, Register],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit, OnDestroy {

  isLoggedIn = false;
  showRegister = false;
  registrationMessage = '';
  showAccount = false;

  showChangePassword = false;

  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';

  passwordMessage = '';
  passwordError = '';
  isChangingPassword = false;

  currentUser: {
    id: number;
    username: string;
    email: string;
  } | null = null;

  private logoutSubscription!: Subscription;
  private navResizeObserver?: ResizeObserver;

  protected readonly title = signal('Game Library');

  games: Game[] = [];
  randomGames: any[] = [];
  expandedGameId: number | null = null;
  searchResults: any[] = [];
  searchQuery = '';
  isSearching = false;
  librarySearchQuery = '';
  libraryPlatformFilter = '';
  librarySort = '';
  libraryGenreFilter = '';
  activeView: 'search' | 'library' = 'library';

  // Small status message shown under the sidebar (e.g. "Added to library")
  toastMessage = '';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ----- WHERE TO BUY -----
  buyGameTitle = '';
  buyInfo: WhereToBuy | null = null;
  buyLoading = false;
  buyError = '';
  showBuyPanel = false;


  toggleGameInfo(id: number) {
    this.expandedGameId = this.expandedGameId === id ? null : id;
  }


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

    return [...new Set(genres)].filter(genre => !!genre);
  }


  newGame = {
    title: '',
    genre: '',
    platform: '',
    release_date: '',
    rating: null as number | null,
    image: '',
    rawg_id: null as number | null,
    favorite: false,
    status: 'Backlog',
    notes: null as string | null
  };


  editingGameId: number | null = null;

  editGame = {
    title: '',
    genre: '',
    platform: '',
    release_date: null as string | null,
    rating: null as number | null,
    image: null as string | null,
    rawg_id: null as number | null,
    favorite: false,
    status: 'Backlog',
    notes: null as string | null
  };

  constructor(
    private gameService: GameService,
    private auth: Auth,
    private cdr: ChangeDetectorRef,
    private host: ElementRef<HTMLElement>,
  ) {
    this.isLoggedIn = this.auth.isLoggedIn();

    // Fires on manual logout and when the session expires
    this.logoutSubscription = this.auth.logout$.subscribe(() => {
      this.resetToLoggedOut();
    });

    if (this.isLoggedIn) {
      this.auth.getCurrentUser().subscribe({
        next: (user) => {
          this.currentUser = user;
          this.getGames();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to restore login:', error);
          this.auth.logout();
        }
      });
    } else {
      this.getRandomGames();
    }
  }

  // Keep --nav-h equal to the navbar's real height so the sticky
  // sidebar starts exactly at its bottom edge.
  ngAfterViewInit() {
    const container = this.host.nativeElement.querySelector<HTMLElement>('.app-container');
    const navbar = this.host.nativeElement.querySelector<HTMLElement>('.navbar');

    if (!container || !navbar || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.navResizeObserver = new ResizeObserver(() => {
      container.style.setProperty('--nav-h', `${navbar.offsetHeight}px`);
    });

    this.navResizeObserver.observe(navbar);
  }

  ngOnDestroy() {
    this.logoutSubscription?.unsubscribe();
    this.navResizeObserver?.disconnect();
  }

  get isGuest(): boolean {
    return this.auth.isGuest();
  }

  continueAsGuest() {
    this.auth.loginAsGuest();
    this.loginSuccess();
  }

  logout() {
    this.auth.logout();
  }

  private resetToLoggedOut() {
    this.isLoggedIn = false;
    this.currentUser = null;
    this.showAccount = false;
    this.showChangePassword = false;
    this.games = [];
    this.searchResults = [];
    this.activeView = 'library';
    this.closeBuyPanel();

    if (this.randomGames.length === 0) {
      this.getRandomGames();
    }

    this.cdr.markForCheck();
  }

  private showToast(message: string) {
    this.toastMessage = message;
    this.cdr.markForCheck();

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 2500);
  }


  loginSuccess() {
    this.isLoggedIn = true;
    this.cdr.markForCheck();

    this.auth.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.getGames();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Failed to get current user:', error);
        this.cdr.markForCheck();
      }
    });
  }

  registerSuccess() {
    this.showRegister = false;
    this.registrationMessage = 'Account created successfully!';
    this.cdr.markForCheck();

    setTimeout(() => {
      this.registrationMessage = '';
      this.cdr.markForCheck();
    }, 3000);
  }

  getGames() {
    this.gameService.getGames().subscribe({
      next: response => {
        this.games = response;
        this.searchResults = [];
        this.activeView = 'library';
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Error loading library:', error);
      }
    });
  }

  getRandomGames() {
    this.gameService.getRandomGames().subscribe({
      next: (games) => {
        this.randomGames = games;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading random games:', error);
      }
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
    if (!this.newGame.title.trim()) {
      this.showToast('Enter a game title first.');
      return;
    }

    this.gameService.addGame(this.newGame).subscribe({
      next: response => {
        this.games = [...this.games, response];
        this.activeView = 'library';

        this.newGame = {
          title: '',
          genre: '',
          platform: '',
          release_date: '',
          rating: null,
          image: '',
          rawg_id: null,
          favorite: false,
          status: 'Backlog',
          notes: null
        };

        this.showToast(`Added "${response.title}" to your library.`);
      },
      error: error => {
        console.error('Error adding game:', error);
        this.showToast('Could not add that game.');
      }
    });
  }

  deleteGame(id: number) {
    this.gameService.deleteGame(id).subscribe({
      next: () => {
        this.games = this.games.filter(game => game.id !== id);

        if (this.expandedGameId === id) {
          this.expandedGameId = null;
        }

        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Error deleting game:', error);
        this.showToast('Could not delete that game.');
      }
    });
  }

  private saveGame(game: Game) {
    this.gameService.updateGame(game.id, {
      title: game.title,
      genre: game.genre ?? '',
      platform: game.platform ?? '',
      release_date: game.release_date,
      rating: game.rating,
      image: game.image,
      rawg_id: game.rawg_id,
      favorite: game.favorite,
      status: game.status,
      notes: game.notes
    }).subscribe({
      error: error => {
        console.error('Error saving game:', error);
        this.showToast('Could not save your change.');
      }
    });
  }

  toggleFavorite(game: Game) {
    game.favorite = !game.favorite;
    this.saveGame(game);
  }

  updateGameStatus(game: Game, status: string) {
    game.status = status;
    this.saveGame(game);
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
      rawg_id: game.rawg_id,
      favorite: game.favorite,
      status: game.status,
      notes: game.notes
    };
  }

  updateGame(id: number) {
    if (!this.editGame.title.trim()) {
      this.showToast('A game needs a title.');
      return;
    }

    this.gameService.updateGame(id, this.editGame).subscribe({
      next: response => {
        this.games = this.games.map(game => game.id === id ? response : game);
        this.cancelEditing();
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Error updating game:', error);
        this.showToast('Could not save your changes.');
      }
    });
  }


  changePassword() {
    this.passwordMessage = '';
    this.passwordError = '';

    if (!this.currentPassword || !this.newPassword) {
      this.passwordError = 'Fill in every field.';
      this.cdr.markForCheck();
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordError = 'New passwords do not match.';
      this.cdr.markForCheck();
      return;
    }

    this.isChangingPassword = true;
    this.cdr.markForCheck();

    this.auth.changePassword(
      this.currentPassword,
      this.newPassword
    ).subscribe({
      next: () => {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmNewPassword = '';

        this.isChangingPassword = false;
        this.passwordMessage = 'Password changed successfully!';
        this.passwordError = '';

        this.cdr.markForCheck();
      },

      error: (error) => {
        this.isChangingPassword = false;

        if (error.status === 400) {
          this.passwordError =
            error.error?.detail || 'Current password is incorrect.';
        } else {
          this.passwordError =
            'Something went wrong. Please try again.';
        }

        this.cdr.markForCheck();
      }
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
      rawg_id: null,
      favorite: false,
      status: 'Backlog',
      notes: null
    };
  }

  searchGames() {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }

    this.isSearching = true;

    this.gameService.searchGames(this.searchQuery.trim()).subscribe({
      next: response => {
        this.searchResults = response;
        this.activeView = 'search';
        this.isSearching = false;
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Error searching games:', error);
        this.isSearching = false;
        this.showToast('Search failed. Please try again.');
      }
    });
  }

  isInLibrary(game: any): boolean {
    return !!game.rawg_id && this.games.some(g => g.rawg_id === game.rawg_id);
  }

  addToLibrary(game: any) {
    const newGame = {
      title: game.title,
      genre: game.genre,
      platform: '',
      release_date: game.release_date,
      rating: game.rating,
      image: game.image,
      rawg_id: game.rawg_id,
      favorite: false,
      status: 'Backlog',
      notes: null
    };

    this.gameService.addGame(newGame).subscribe({
      next: response => {
        this.games = [...this.games, response];
        this.showToast(`Added "${response.title}" to your library.`);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 409) {
          this.showToast('This game is already in your library!');
        } else {
          this.showToast('Could not add that game.');
        }
      }
    });
  }


  // ----- WHERE TO BUY -----

  openBuyPanel(game: { title: string; rawg_id: number | null }) {
    this.buyGameTitle = game.title;
    this.buyInfo = null;
    this.buyError = '';
    this.buyLoading = true;
    this.showBuyPanel = true;

    this.gameService.whereToBuy(game.title, game.rawg_id).subscribe({
      next: info => {
        // Ignore a late answer for a game the user has moved on from
        if (this.buyGameTitle !== game.title) return;

        this.buyInfo = info;
        this.buyLoading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Error loading store links:', error);
        this.buyLoading = false;
        this.buyError = 'Could not load store info. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  closeBuyPanel() {
    this.showBuyPanel = false;
    this.buyInfo = null;
    this.buyGameTitle = '';
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showBuyPanel) {
      this.closeBuyPanel();
    }
  }
}
