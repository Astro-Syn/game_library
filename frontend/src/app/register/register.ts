import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
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
  successMessage = '';

  constructor(private auth: Auth, private cdr: ChangeDetectorRef) {}

  register() {

    this.registerError = '';
    this.successMessage = '';

    if (!this.username.trim() || !this.email.trim() || !this.password) {
      this.registerError = 'Please fill in every field.';
      return;
    }

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
  

  this.username = '';
  this.email = '';
  this.password = '';
  this.confirmPassword = '';
  this.successMessage = 'Account created! Taking you to login...';
  this.cdr.markForCheck();

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

        this.cdr.markForCheck();
      }
    });
  }
}