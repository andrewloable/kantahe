package lyrics

import (
	"reflect"
	"testing"
)

func w(text string, start int64) Word { return Word{Text: text, StartMs: start} }

func ends(l Line) []int64 {
	var out []int64
	for _, x := range l.Words {
		out = append(out, x.EndMs)
	}
	return out
}

func TestWordEnds(t *testing.T) {
	lines := Layout([][]Word{
		{w("a", 1000), w("b", 1500), w("c", 2000)},
		{w("d", 5000)},
	})
	if got, want := ends(lines[0]), []int64{1500, 2000, 2500}; !reflect.DeepEqual(got, want) {
		t.Fatalf("ends = %v, want %v", got, want)
	}
	if lines[0].StartMs != 1000 || lines[0].EndMs != 2500 {
		t.Errorf("line span = %d-%d, want 1000-2500", lines[0].StartMs, lines[0].EndMs)
	}
}

func TestMedianNotMean(t *testing.T) {
	// gaps 100, 100, 2000: median 100 -> clamped to 300 (the mean, 733, would give 733)
	lines := Layout([][]Word{{w("a", 0), w("b", 100), w("c", 200), w("d", 2200)}, {w("n", 90000)}})
	if got := ends(lines[0])[3]; got != 2200+300 {
		t.Fatalf("last end = %d, want %d", got, 2200+300)
	}
}

func TestMedianTakesIndexLenOver2(t *testing.T) {
	// gaps 400, 600 sorted [400,600]: index 1 -> 600
	lines := Layout([][]Word{{w("a", 0), w("b", 400), w("c", 1000)}, {w("n", 90000)}})
	if got := ends(lines[0])[2]; got != 1000+600 {
		t.Fatalf("last end = %d, want 1600", got)
	}
}

func TestLastWordCappedByNextLine(t *testing.T) {
	lines := Layout([][]Word{{w("a", 1000), w("b", 2000)}, {w("n", 2400)}})
	if got := ends(lines[0])[1]; got != 2400 {
		t.Fatalf("last end = %d, want 2400", got)
	}
}

func TestLastWordCapNeverBelowMinimumWipe(t *testing.T) {
	// next line starts 10 ms after the last word: the wipe still lasts 50 ms
	lines := Layout([][]Word{{w("a", 1000), w("b", 2000)}, {w("n", 2010)}})
	if got := ends(lines[0])[1]; got != 2050 {
		t.Fatalf("last end = %d, want 2050", got)
	}
}

func TestMinimumWipe(t *testing.T) {
	lines := Layout([][]Word{{w("a", 1000), w("b", 1000)}, {w("n", 9000)}})
	if got := ends(lines[0])[0]; got != 1050 {
		t.Fatalf("first end = %d, want 1050", got)
	}
}

func TestClampLow(t *testing.T) {
	lines := Layout([][]Word{{w("a", 0), w("b", 100), w("c", 200)}, {w("n", 90000)}})
	if got := ends(lines[0])[2]; got != 200+300 {
		t.Fatalf("last end = %d, want 500", got)
	}
}

func TestClampHigh(t *testing.T) {
	lines := Layout([][]Word{{w("a", 0), w("b", 3000), w("c", 6000)}, {w("n", 90000)}})
	if got := ends(lines[0])[2]; got != 6000+1200 {
		t.Fatalf("last end = %d, want 7200", got)
	}
}

func TestSingleWordLine(t *testing.T) {
	lines := Layout([][]Word{{w("a", 1000)}, {w("n", 9000)}})
	if got := ends(lines[0])[0]; got != 1500 {
		t.Fatalf("end = %d, want 1500", got)
	}
}

func TestNoNextLineMeansNoUpperBound(t *testing.T) {
	lines := Layout([][]Word{{w("a", 1000), w("b", 2000)}})
	if got := ends(lines[0])[1]; got != 3000 {
		t.Fatalf("end = %d, want 3000", got)
	}
}

func TestOnlyPositiveGapsCount(t *testing.T) {
	// equal starts give a zero gap that must not count: positive gaps are [400]
	lines := Layout([][]Word{{w("a", 0), w("b", 0), w("c", 400)}, {w("n", 90000)}})
	if got := ends(lines[0])[2]; got != 400+400 {
		t.Fatalf("last end = %d, want 800", got)
	}
}

func TestDropsEmptyLinesAndKeepsOrder(t *testing.T) {
	lines := Layout([][]Word{{}, {w("x", 10)}, nil, {w("y", 5000), w("z", 5200)}})
	if len(lines) != 2 {
		t.Fatalf("lines = %d, want 2", len(lines))
	}
	if lines[0].Words[0].Text != "x" || lines[1].Words[1].Text != "z" {
		t.Errorf("order not kept: %+v", lines)
	}
	// the line before an emptied line is capped by the next real line
	if got := ends(lines[0])[0]; got != 510 {
		t.Errorf("end = %d, want 510 (default 500 ms)", got)
	}
}

func TestLayoutIgnoresInputEnds(t *testing.T) {
	lines := Layout([][]Word{{{Text: "a", StartMs: 0, EndMs: 99999}, {Text: "b", StartMs: 700, EndMs: 99999}}})
	if got := ends(lines[0])[0]; got != 700 {
		t.Fatalf("end = %d, want 700", got)
	}
}

func TestActiveLine(t *testing.T) {
	lines := []Line{{StartMs: 1000}, {StartMs: 5000}}
	cases := []struct{ t, want int64 }{{500, -1}, {949, -1}, {950, 0}, {3000, 0}, {4949, 0}, {4950, 1}, {4960, 1}, {5100, 1}, {1 << 40, 1}}
	for _, c := range cases {
		if got := ActiveLine(lines, c.t); int64(got) != c.want {
			t.Errorf("ActiveLine(t=%d) = %d, want %d", c.t, got, c.want)
		}
	}
	if got := ActiveLine(nil, 1000); got != -1 {
		t.Errorf("no lines: %d, want -1", got)
	}
}

func TestToProto(t *testing.T) {
	lines := Layout([][]Word{{w("Hel", 1000), w("lo", 1500)}, {w("x", 4000)}})
	p := ToProto("01052", "kar", 180000, lines)
	if p.Number != "01052" || p.Source != "kar" || p.DurationMs != 180000 || len(p.Lines) != 2 {
		t.Fatalf("bad header: %+v", p)
	}
	l := p.Lines[0]
	if l.StartMs != 1000 || l.EndMs != 2000 || len(l.Words) != 2 {
		t.Fatalf("bad line: %+v", l)
	}
	if wd := l.Words[0]; wd.Text != "Hel" || wd.StartMs != 1000 || wd.EndMs != 1500 {
		t.Errorf("bad word: %+v", wd)
	}
}

func TestLayoutDoesNotMutateInput(t *testing.T) {
	in := [][]Word{{w("a", 1000), w("b", 1500)}, {w("c", 5000)}}
	Layout(in)
	if in[0][0].EndMs != 0 || in[0][1].EndMs != 0 || in[1][0].EndMs != 0 {
		t.Fatalf("input was modified: %+v", in)
	}
}

func TestToProtoCopiesData(t *testing.T) {
	lines := Layout([][]Word{{w("a", 1000)}})
	p := ToProto("1", "lrc", 1, lines)
	lines[0].Words[0].Text = "changed"
	lines[0].StartMs = 7
	if p.Lines[0].Words[0].Text != "a" || p.Lines[0].StartMs != 1000 {
		t.Fatalf("proto shares data with the input: %+v", p.Lines[0])
	}
	if got := ToProto("1", "lrc", 1, nil); len(got.Lines) != 0 {
		t.Errorf("no lines: %+v", got)
	}
}

func TestActiveLineNegativeTime(t *testing.T) {
	if got := ActiveLine([]Line{{StartMs: 0}}, -1000); got != -1 {
		t.Fatalf("got %d, want -1", got)
	}
	if got := ActiveLine([]Line{{StartMs: 0}}, -50); got != 0 {
		t.Fatalf("got %d, want 0 (50 ms lead)", got)
	}
}
