import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {

  constructor(private http: HttpClient) {}

login(username: string, password: string) {
  return this.http.post<LoginResponse>(
    'http://127.0.0.1:8000/api/auth/login',
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
  return this.http.post('http://127.0.0.1:8000/api/auth/register', {
    username: username,
    email: email,
    password: password
  });
}

getAccessToken() {
  return localStorage.getItem('access_token');
}

isLoggedIn() {
  return !!this.getAccessToken();
}

logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

}