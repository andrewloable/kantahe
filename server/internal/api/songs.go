package api

import (
	"context"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/userlib"
)

// toProtoSong converts a library entry; favourite is the calling user's flag.
func toProtoSong(s library.SongInfo, favourite bool) *kantahev1.Song {
	return &kantahev1.Song{
		Number: s.Number, Format: kantahev1.Format(s.Format), Title: s.Title, Artist: s.Artist,
		SongbookNumber: s.Songbook, DurationMs: s.DurationMs, Failed: s.Failed, Favourite: favourite,
	}
}

// markFavourites sets the favourite flag of the songs for the user, with one query.
func markFavourites(ctx context.Context, ul *userlib.Library, userID string, songs ...*kantahev1.Song) error {
	var numbers []string
	for _, s := range songs {
		if s != nil {
			numbers = append(numbers, s.Number)
		}
	}
	if len(numbers) == 0 {
		return nil
	}
	set, err := ul.FavouriteSet(ctx, userID, numbers)
	if err != nil {
		return err
	}
	for _, s := range songs {
		if s != nil {
			s.Favourite = set[s.Number]
		}
	}
	return nil
}
