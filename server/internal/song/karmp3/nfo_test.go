package karmp3

import (
	"reflect"
	"testing"
)

func TestParseNFO(t *testing.T) {
	got := ParseNFO("Title : Heto\nArtist:Daryl\n")
	if want := map[string]string{"Title": "Heto", "Artist": "Daryl"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestNFOEdgeCases(t *testing.T) {
	got := ParseNFO("\ufeffTitle : A : B\r\n\r\nno colon here\r\n : empty key\nKey :\n  Spaced  :   value  \n")
	want := map[string]string{"Title": "A : B", "Key": "", "Spaced": "value"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestNFOLookupIgnoresKeyCase(t *testing.T) {
	if v := lookup(ParseNFO("TITLE : X"), "Title"); v != "X" {
		t.Fatalf("lookup = %q", v)
	}
	if v := lookup(nil, "Title"); v != "" {
		t.Fatalf("lookup on nil = %q", v)
	}
}
