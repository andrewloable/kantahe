package library

import (
	"context"
	"math/rand"
	"reflect"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/store"
)

func set(nums ...string) map[string]bool {
	m := map[string]bool{}
	for _, n := range nums {
		m[n] = true
	}
	return m
}

func TestSongbook(t *testing.T) {
	cases := map[string]string{
		"01052 - A - B.kar":     "01052",
		"1052 - A.kar":          "01052",
		"123456 x.kar":          "123456",
		"Song.kar":              "",
		"0 - x.kar":             "00000",
		"00000052 - x.kar":      "00052",
		"/music/dir/77 - a.kar": "00077",
		`C:\songs\77 - a.kar`:   "00077",
		"12ab - x.kar":          "00012",
		"x 123.kar":             "",
		"٣٤٥ x.kar":             "", // non-ASCII digits are not digits here
		"999999999 - x.kar":     "999999999",
		"1234567890 - x.kar":    "", // more than 9 digits is not a song number
		"0000000000012 - x.kar": "00012",
		"":                      "",
	}
	for in, want := range cases {
		if got := Songbook(in); got != want {
			t.Errorf("Songbook(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestMP3KeepsNumber(t *testing.T) {
	got := Allocate(set("21627"), []NewFile{
		{Path: "a/01052 - A - B.kar", Format: FormatMIDI, Songbook: "01052"},
		{Path: "a/01052 - A - B.karmp3", Format: FormatMP3, Songbook: "01052"},
	})
	want := map[string]string{"a/01052 - A - B.karmp3": "01052", "a/01052 - A - B.kar": "21628"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestExistingWins(t *testing.T) {
	got := Allocate(set("01052"), []NewFile{{Path: "x.karmp3", Format: FormatMP3, Songbook: "01052"}})
	if got["x.karmp3"] != "01053" {
		t.Fatalf("got %v; an existing number never changes, so the later MP3 is renumbered", got)
	}
}

func TestAutoNumber(t *testing.T) {
	got := Allocate(set("00007"), []NewFile{{Path: "Song.kar", Format: FormatMIDI}})
	if got["Song.kar"] != "00008" {
		t.Fatalf("got %v", got)
	}
	if got := Allocate(nil, []NewFile{{Path: "Song.kar", Format: FormatMIDI}}); got["Song.kar"] != "00001" {
		t.Fatalf("empty library: %v", got)
	}
}

func TestDeletedNotReused(t *testing.T) {
	// existing includes deleted rows, so a returning 00010 cannot take its old number back
	got := Allocate(set("00010"), []NewFile{{Path: "00010 x.kar", Format: FormatMIDI, Songbook: "00010"}})
	if got["00010 x.kar"] != "00011" {
		t.Fatalf("got %v", got)
	}
}

func TestDeterministic(t *testing.T) {
	batch := []NewFile{
		{Path: "b/00005 b.kar", Format: FormatMIDI, Songbook: "00005"},
		{Path: "a/00005 a.kar", Format: FormatMIDI, Songbook: "00005"},
		{Path: "c/Song.kar", Format: FormatMIDI},
		{Path: "a/00005 a.karmp3", Format: FormatMP3, Songbook: "00005"},
		{Path: "z/Other.karmp3", Format: FormatMP3},
		{Path: "m/00009 m.kar", Format: FormatMIDI, Songbook: "00009"},
	}
	want := Allocate(set("00001"), batch)
	rng := rand.New(rand.NewSource(1))
	for i := 0; i < 50; i++ {
		shuffled := append([]NewFile(nil), batch...)
		rng.Shuffle(len(shuffled), func(a, b int) { shuffled[a], shuffled[b] = shuffled[b], shuffled[a] })
		if got := Allocate(set("00001"), shuffled); !reflect.DeepEqual(got, want) {
			t.Fatalf("order changed the result:\n%v\n%v", got, want)
		}
	}
}

func TestSameFormatClash(t *testing.T) {
	got := Allocate(nil, []NewFile{
		{Path: "00005 b.kar", Format: FormatMIDI, Songbook: "00005"},
		{Path: "00005 a.kar", Format: FormatMIDI, Songbook: "00005"},
	})
	if got["00005 a.kar"] != "00005" || got["00005 b.kar"] != "00006" {
		t.Fatalf("got %v; the first by path keeps it, the other gets max+1", got)
	}
}

func TestCanonicalClash(t *testing.T) {
	got := Allocate(set("01052"), []NewFile{{Path: "1052 x.kar", Format: FormatMIDI, Songbook: Songbook("1052 x.kar")}})
	if got["1052 x.kar"] != "01053" {
		t.Fatalf("got %v", got)
	}
	// non-canonical keys in the existing set still clash
	got = Allocate(set("1052"), []NewFile{{Path: "01052 x.kar", Format: FormatMIDI, Songbook: "01052"}})
	if got["01052 x.kar"] != "01053" {
		t.Fatalf("got %v", got)
	}
}

func TestAutoNumbersFollowTheHighestEverAssigned(t *testing.T) {
	// the auto number counts numbers claimed earlier in the same batch
	got := Allocate(set("00007"), []NewFile{
		{Path: "a/Song.karmp3", Format: FormatMP3},
		{Path: "b/00500 x.karmp3", Format: FormatMP3, Songbook: "00500"},
		{Path: "c/Other.kar", Format: FormatMIDI},
	})
	want := map[string]string{"b/00500 x.karmp3": "00500", "a/Song.karmp3": "00008", "c/Other.kar": "00501"}
	// MP3 group is sorted by path: a/Song gets 00008 first, then b keeps 00500, then the MIDI file follows the maximum
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestGrowsBeyondFiveDigits(t *testing.T) {
	got := Allocate(set("99999"), []NewFile{{Path: "Song.kar", Format: FormatMIDI}})
	if got["Song.kar"] != "100000" {
		t.Fatalf("got %v", got)
	}
}

func TestNonNumericExistingKeysAreIgnored(t *testing.T) {
	got := Allocate(set("abc", "00003"), []NewFile{{Path: "Song.kar", Format: FormatMIDI}})
	if got["Song.kar"] != "00004" {
		t.Fatalf("got %v", got)
	}
}

func TestDuplicatePathGetsOneNumber(t *testing.T) {
	got := Allocate(nil, []NewFile{{Path: "a.kar", Format: FormatMIDI}, {Path: "a.kar", Format: FormatMIDI}})
	if len(got) != 1 || got["a.kar"] != "00001" {
		t.Fatalf("got %v", got)
	}
}

func TestExistingNumbersIncludesDeleted(t *testing.T) {
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ins := `INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, created_at, deleted) VALUES (?, 1, 1, ?, ?, 1, 1, 'x', 1, ?)`
	if _, err := db.Exec(ins, "00010", "p1", "h1", 0); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ins, "00011", "p2", "h2", 1); err != nil {
		t.Fatal(err)
	}
	got, err := ExistingNumbers(context.Background(), db)
	if err != nil || !reflect.DeepEqual(got, set("00010", "00011")) {
		t.Fatalf("%v %v", got, err)
	}
}

func TestSongsSchema(t *testing.T) {
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, created_at) VALUES ('00001',1,1,'p','h',1,1,'x',1)`); err != nil {
		t.Fatal(err)
	}
	var failed, deleted, metadataDone int
	var title, media string
	if err := db.QueryRow(`SELECT failed, deleted, metadata_done, file_title, media_path FROM songs WHERE number='00001'`).Scan(&failed, &deleted, &metadataDone, &title, &media); err != nil {
		t.Fatal(err)
	}
	if failed != 0 || deleted != 0 || metadataDone != 0 || title != "" || media != "" {
		t.Fatal("defaults wrong")
	}
	if _, err := db.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, created_at) VALUES ('00002',1,1,'p','h2',1,1,'x',1)`); err == nil {
		t.Fatal("path must be unique")
	}
	if _, err := db.Exec(`INSERT INTO song_edits(number, title) VALUES ('99999','x')`); err == nil {
		t.Fatal("song_edits must reference songs")
	}
	if _, err := db.Exec(`INSERT INTO song_edits(number, title, artist) VALUES ('00001','T',NULL)`); err != nil {
		t.Fatalf("edits may leave a field NULL: %v", err)
	}
}

func TestRegression_HugeExistingNumbersDoNotOverflow(t *testing.T) {
	got := Allocate(set("99999999999999999999999", "00003"), []NewFile{{Path: "Song.kar", Format: FormatMIDI}})
	if got["Song.kar"] != "100000000000000000000000" {
		t.Fatalf("got %v; the next number must follow the highest ever assigned, however long", got["Song.kar"])
	}
	// at the uint64 limit
	got = Allocate(set("18446744073709551615"), []NewFile{{Path: "Song.kar", Format: FormatMIDI}})
	if got["Song.kar"] != "18446744073709551616" {
		t.Fatalf("got %v", got["Song.kar"])
	}
}
