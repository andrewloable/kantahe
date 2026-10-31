package karmp3

import "strings"

// ParseNFO reads "Key : value" lines. The first colon splits key from value,
// both are trimmed, and the first occurrence of a key wins.
func ParseNFO(text string) map[string]string {
	out := map[string]string{}
	for _, line := range strings.Split(strings.TrimPrefix(text, "\xef\xbb\xbf"), "\n") {
		k, v, ok := strings.Cut(line, ":")
		k = strings.TrimSpace(k)
		if !ok || k == "" {
			continue
		}
		if _, dup := out[k]; !dup {
			out[k] = strings.TrimSpace(v)
		}
	}
	return out
}

// lookup finds a key ignoring case.
func lookup(m map[string]string, key string) string {
	for k, v := range m {
		if strings.EqualFold(k, key) {
			return v
		}
	}
	return ""
}
