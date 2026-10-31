package gen_test

import (
	"net/http"
	"testing"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
)

func TestServicesCompile(t *testing.T) {
	handlers := map[string]func() (string, http.Handler){
		"auth": func() (string, http.Handler) {
			return kantahev1connect.NewAuthServiceHandler(kantahev1connect.UnimplementedAuthServiceHandler{})
		},
		"admin": func() (string, http.Handler) {
			return kantahev1connect.NewAdminServiceHandler(kantahev1connect.UnimplementedAdminServiceHandler{})
		},
		"upload": func() (string, http.Handler) {
			return kantahev1connect.NewUploadServiceHandler(kantahev1connect.UnimplementedUploadServiceHandler{})
		},
		"catalog": func() (string, http.Handler) {
			return kantahev1connect.NewCatalogServiceHandler(kantahev1connect.UnimplementedCatalogServiceHandler{})
		},
		"session": func() (string, http.Handler) {
			return kantahev1connect.NewSessionServiceHandler(kantahev1connect.UnimplementedSessionServiceHandler{})
		},
		"userlibrary": func() (string, http.Handler) {
			return kantahev1connect.NewUserLibraryServiceHandler(kantahev1connect.UnimplementedUserLibraryServiceHandler{})
		},
	}
	for name, mk := range handlers {
		if path, h := mk(); path == "" || h == nil {
			t.Errorf("%s: empty path or nil handler", name)
		}
	}
	if got := int(kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE); got != 2 {
		t.Errorf("CONTROL_ACTION_PLAY_HERE = %d, want 2", got)
	}
}
