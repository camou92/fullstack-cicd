import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AddMovieComponent } from './components/add-movie/add-movie.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';

export const routes: Routes = [
    {path: '', title: "MovieApp - Home", component: HomeComponent},
    {path: 'login', title: "MovieApp - Login", component: LoginComponent},
    {path: 'register', title: "MovieApp - Register", component: RegisterComponent},
    {path: 'forgot-password', title: "MovieApp - Forgot Password", component: ForgotPasswordComponent},
    {path: 'add-movie', title: "MovieApp - Add Movie", component: AddMovieComponent},
];
