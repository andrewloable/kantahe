package app

import (
	"net/http"

	connectcors "connectrpc.com/cors"
	"github.com/rs/cors"
)

// preflightMaxAge is how long, in seconds, a browser may remember an answer to a preflight request.
const preflightMaxAge = 7200

// CORS answers cross-origin requests for the API and the media routes. Packaged TV apps (Tizen, webOS) load
// from the device and send Origin: null, so no fixed origin can be named. That is safe here: a token travels
// in the Authorization header, never in a cookie, so a page of another origin has no ambient credentials to
// abuse, and credentials are never allowed.
func CORS(h http.Handler) http.Handler {
	return cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   connectcors.AllowedMethods(),
		AllowedHeaders:   append(connectcors.AllowedHeaders(), "Authorization", "Range"),
		ExposedHeaders:   append(connectcors.ExposedHeaders(), "Content-Range", "Accept-Ranges"),
		AllowCredentials: false,
		MaxAge:           preflightMaxAge,
	}).Handler(h)
}

// HandleAPI registers an API or media route with CORS answered; the web app's own files are not wrapped.
func (a *App) HandleAPI(pattern string, h http.Handler) { a.Handle(pattern, CORS(h)) }
