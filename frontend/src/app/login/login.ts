import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  username = '';
  password = '';

  constructor(private auth: Auth) {}

  login() {
    this.auth.login(this.username, this.password).subscribe({
      next: (response) => {
        console.log('Login successful!', response);
      },
      error: (error) => {
        console.error('Login failed:', error);
      }
    });
  }

}