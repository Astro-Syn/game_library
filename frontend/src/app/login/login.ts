import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  @Output() loginSuccess = new EventEmitter<void>();

  username = '';
  password = '';
  loginError = '';

  constructor(private auth: Auth) {}

login() {
  this.loginError = '';

  this.auth.login(this.username, this.password).subscribe({
    next: () => {
      this.loginSuccess.emit();
    },
    error: (error) => {
      console.error('Login failed:', error);

      if (error.status === 401) {
        this.loginError = 'Invalid username or password.';
      } else {
        this.loginError = 'Something went wrong. Please try again.';
      }
    }
  });
}

}