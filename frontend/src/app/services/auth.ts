import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, of, tap } from 'rxjs';
import { API_BASE } from '../api';

// Guest sessions live in sessionStorage: they survive a page refresh
// but are wiped as soon as the tab is closed, and never touch the database.

export const GUEST_FLAG_KEY = 'guest_session';
export const GUEST_GAMES_KEY = 'guest_games';

export const GUEST_USER = {
  id: 0,
  username: 'Guest',
  email: ''
};

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {

  private logoutSubject = new Subject<void>();

logout$ = this.logoutSubject.asObservable();

  constructor(private http: HttpClient) {}

login(username: string, password: string) {
  sessionStorage.removeItem(GUEST_FLAG_KEY);
  sessionStorage.removeItem(GUEST_GAMES_KEY);

  return this.http.post<LoginResponse>(
    `${API_BASE}/auth/login`,
    {
      username: username,
      password: password
    }
  ).pipe(
    tap(response => {
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
    })
  );
}

register(username: string, email: string, password: string) {
  return this.http.post(`${API_BASE}/auth/register`, {
    username: username,
    email: email,
    password: password
  });
}

getAccessToken() {
  return localStorage.getItem('access_token');
}

loginAsGuest() {

  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');

  sessionStorage.setItem(GUEST_FLAG_KEY, '1');
}

isGuest() {
  return sessionStorage.getItem(GUEST_FLAG_KEY) === '1';
}

getCurrentUser() {
  if (this.isGuest()) {
    return of(GUEST_USER);
  }

  return this.http.get<{
    id: number;
    username: string;
    email: string;
  }>(
    `${API_BASE}/auth/me`
  );
}

changePassword(
  currentPassword: string,
  newPassword: string
) {
  return this.http.post(
    `${API_BASE}/auth/change-password`,
    {
      current_password: currentPassword,
      new_password: newPassword
    }
  );
}


refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');

  return this.http.post<{ access_token: string }>(
    `${API_BASE}/auth/refresh`,
    null,
    {
      params: {
        refresh_token: refreshToken ?? ''
      }
    }
  ).pipe(
    tap(response => {
      localStorage.setItem(
        'access_token',
        response.access_token
      );
    })
  );
}


isLoggedIn() {
  return this.isGuest() || !!this.getAccessToken();
}

logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  sessionStorage.removeItem(GUEST_FLAG_KEY);
  sessionStorage.removeItem(GUEST_GAMES_KEY);

  this.logoutSubject.next();
}

}