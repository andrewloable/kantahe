package testfix

import (
	"archive/zip"
	"bytes"
	"time"
)

// KARMP3 builds a .karmp3 (a deflated ZIP) holding base.mp3 and, when not
// empty, base.lrc and base.nfo. Timestamps are fixed so output is deterministic.
func KARMP3(base string, mp3 []byte, lrc, nfo string) []byte {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	add := func(name string, body []byte) {
		w, err := zw.CreateHeader(&zip.FileHeader{
			Name:     name,
			Method:   zip.Deflate,
			Modified: time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC),
		})
		if err != nil {
			panic(err)
		}
		if _, err := w.Write(body); err != nil {
			panic(err)
		}
	}
	add(base+".mp3", mp3)
	if lrc != "" {
		add(base+".lrc", []byte(lrc))
	}
	if nfo != "" {
		add(base+".nfo", []byte(nfo))
	}
	if err := zw.Close(); err != nil {
		panic(err)
	}
	return buf.Bytes()
}
