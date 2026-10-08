import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {

  @Output() registerSuccess = new EventEmitter<void>();

  username = '';
  email = '';
  password = '';
  confirmPassword = '';

  registerError = '';
  registerSuccessMessage = '';

  constructor(private auth: Auth) {}

  register() {

    this.registerError = '';
    this.registerSuccessMessage = '';

    if (this.password !== this.confirmPassword) {
      this.registerError = 'Passwords do not match.';
      return;
    }

    this.auth.register(
      this.username,
      this.email,
      this.password
    ).subscribe({
      next: () => {
  this.registerSuccessMessage = 'Account created successfully!';

  this.username = '';
  this.email = '';
  this.password = '';
  this.confirmPassword = '';

  setTimeout(() => {
    this.registerSuccess.emit();
  }, 2000);
},
      error: (error) => {
        console.error('Registration failed:', error);

        if (error.status === 400) {
          this.registerError = error.error?.detail
            || 'Username or email already exists.';
        } else {
          this.registerError = 'Something went wrong. Please try again.';
        }
      }
    });
  }
}