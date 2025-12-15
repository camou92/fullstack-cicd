import { Component, Inject } from '@angular/core';
import { FormControl, Validators, FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MovieDto, MovieService } from '../../services/movie.service';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-update-movie',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './update-movie.component.html',
  styleUrls: ['./update-movie.component.css'] // ✅ corrigé
})
export class UpdateMovieComponent {

  movieId!: number;
  poster!: string | null;

  title!: FormControl<string>;
  director!: FormControl<string>;
  studio!: FormControl<string>;
  movieCast!: FormControl<string>;
  releaseYear!: FormControl<string>;

  selectedFile: File | null = null;
  updateMovieForm!: FormGroup;

  inlineNotification = {
    show: false,
    type: '',
    text: '',
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { movie: MovieDto },
    private dialogRef: MatDialogRef<UpdateMovieComponent>,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private movieService: MovieService
  ) {
    // ✅ Les données injectées sont maintenant disponibles ici
    this.movieId = data.movie.movieId!;
    this.poster = data.movie.poster ?? null;

    // ✅ Initialisation des contrôles du formulaire
    this.title = new FormControl<string>(data.movie.title, { nonNullable: true, validators: [Validators.required] });
    this.director = new FormControl<string>(data.movie.director, { nonNullable: true, validators: [Validators.required] });
    this.studio = new FormControl<string>(data.movie.studio, { nonNullable: true, validators: [Validators.required] });
    this.movieCast = new FormControl<string>(data.movie.movieCast.join(", "), { nonNullable: true, validators: [Validators.required] });
    this.releaseYear = new FormControl<string>(data.movie.releaseYear.toString(), { nonNullable: true, validators: [Validators.required] });

    // ✅ Construction du FormGroup
    this.updateMovieForm = this.formBuilder.group({
      title: this.title,
      studio: this.studio,
      director: this.director,
      movieCast: this.movieCast,
      releaseYear: this.releaseYear,
      poster: [null],
    });
  }

  // ✅ Gestion de la sélection de fichier
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.updateMovieForm.patchValue({ poster: this.selectedFile });
      console.log('Fichier sélectionné :', this.selectedFile.name);
    }
  }

  // ✅ Méthode principale de mise à jour du film
  updateMovie(): void {
    if (!this.authService.isAuthenticated()) {
      console.warn('Utilisateur non authentifié');
      this.inlineNotification = {
        show: true,
        type: 'error',
        text: 'Vous devez être connecté pour effectuer cette action.',
      };
      return;
    }

    if (!this.updateMovieForm.valid) {
      console.warn('Formulaire invalide');
      this.inlineNotification = {
        show: true,
        type: 'error',
        text: 'Veuillez remplir correctement tous les champs.',
      };
      return;
    }

    // 🔹 Transformation du champ "movieCast" (de string → tableau)
    const movieCastStr = this.updateMovieForm.get('movieCast')?.value as string;
    const movieCastArray = movieCastStr
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    // 🔹 Création du MovieDto à envoyer
    const movieDto: MovieDto = {
      title: this.title.value,
      director: this.director.value,
      studio: this.studio.value,
      movieCast: movieCastArray,
      releaseYear: +this.releaseYear.value,
      poster: this.poster // garde l’ancien poster si aucun fichier sélectionné
    };

    console.log('📤 Envoi de la requête de mise à jour...', movieDto);

    // 🔹 Appel du service
    this.movieService.updateMovieService(this.movieId, movieDto, this.selectedFile).subscribe({
      next: (response) => {
        console.log('✅ Film mis à jour :', response);
        this.inlineNotification = {
          show: true,
          type: 'success',
          text: 'Film mis à jour avec succès !',
        };
      },
      error: (err) => {
        console.error('❌ Erreur lors de la mise à jour :', err);
        this.inlineNotification = {
          show: true,
          type: 'error',
          text: 'Une erreur est survenue lors de la mise à jour.',
        };
      },
      complete: () => {
        this.dialogRef.close(true);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
