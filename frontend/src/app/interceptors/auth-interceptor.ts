import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { Auth } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const auth = inject(Auth);

  const token = auth.getAccessToken();

  if (!token) {
    return next(req);
  }

  const authRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authRequest).pipe(
    catchError(error => {

  if (
    error.status !== 401 ||
    req.url.includes('/api/auth/refresh')
  ) {
    return throwError(() => error);
  }

  return auth.refreshAccessToken().pipe(
        switchMap(response => {

          const retryRequest = req.clone({
            setHeaders: {
              Authorization: `Bearer ${response.access_token}`
            }
          });

          return next(retryRequest);
        }),
        catchError(refreshError => {
          auth.logout();

          return throwError(() => refreshError);
        })
      );
    })
  );
};