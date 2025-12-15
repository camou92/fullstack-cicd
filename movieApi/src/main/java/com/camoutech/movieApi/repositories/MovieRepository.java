package com.camoutech.movieApi.repositories;

import com.camoutech.movieApi.entities.Movie;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MovieRepository extends JpaRepository<Movie, Integer> {
}
