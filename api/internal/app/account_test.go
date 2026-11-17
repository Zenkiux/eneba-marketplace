package app_test

import (
	"context"
	"fmt"
	"testing"
)

// Login history lists both browsers; "log out of all sessions" keeps only the current one.
func TestLoginHistoryAndRevokeOthers(t *testing.T) {
	s := newStack(t, "dev")
	laptop := s.signedIn("hist@example.test")
	phone := s.client()
	if r := s.do(phone, "POST", "/api/auth/login", creds("hist@example.test", "longenough")); r.status != 200 {
		t.Fatalf("login: %d", r.status)
	}
	r := s.do(laptop, "GET", "/api/account/sessions", nil)
	list := r.body["sessions"].([]any)
	if len(list) != 2 {
		t.Fatalf("want 2 sessions, got %d", len(list))
	}
	current := 0
	for _, x := range list {
		if x.(map[string]any)["current"] == true {
			current++
		}
	}
	if current != 1 {
		t.Fatalf("exactly one session must be marked current, got %d", current)
	}
	if r := s.do(laptop, "POST", "/api/account/sessions/revoke-others", nil); r.status != 200 || r.body["revoked"].(float64) != 1 {
		t.Fatalf("revoke: %d %v", r.status, r.body)
	}
	if r := s.do(phone, "GET", "/api/auth/me", nil); r.status != 401 {
		t.Fatalf("revoked session still works: %d", r.status)
	}
	if r := s.do(laptop, "GET", "/api/auth/me", nil); r.status != 200 {
		t.Fatalf("current session was revoked: %d", r.status)
	}
}

func TestChangePasswordAndName(t *testing.T) {
	s := newStack(t, "dev")
	c := s.signedIn("pw@example.test")
	other := s.client()
	s.do(other, "POST", "/api/auth/login", creds("pw@example.test", "longenough"))

	if r := s.do(c, "POST", "/api/account/password", map[string]string{"currentPassword": "wrong-one", "newPassword": "brandnew123"}); r.status != 422 {
		t.Fatalf("wrong current password: %d", r.status)
	}
	if r := s.do(c, "POST", "/api/account/password", map[string]string{"currentPassword": "longenough", "newPassword": "short"}); r.status != 422 {
		t.Fatalf("too short new password: %d", r.status)
	}
	if r := s.do(c, "POST", "/api/account/password", map[string]string{"currentPassword": "longenough", "newPassword": "brandnew123"}); r.status != 204 {
		t.Fatalf("change: %d %v", r.status, r.body)
	}
	if r := s.do(other, "GET", "/api/auth/me", nil); r.status != 401 {
		t.Fatal("other sessions must end after a password change")
	}
	if r := s.do(s.client(), "POST", "/api/auth/login", creds("pw@example.test", "longenough")); r.status != 401 {
		t.Fatal("old password still works")
	}
	if r := s.do(s.client(), "POST", "/api/auth/login", creds("pw@example.test", "brandnew123")); r.status != 200 {
		t.Fatal("new password doesn't work")
	}
	if r := s.do(c, "PATCH", "/api/account/profile", map[string]string{"displayName": "  Gamer  "}); r.status != 200 ||
		r.body["user"].(map[string]any)["displayName"] != "Gamer" {
		t.Fatalf("rename: %d %v", r.status, r.body)
	}
	if r := s.do(c, "PATCH", "/api/account/profile", map[string]string{"displayName": " "}); r.status != 422 {
		t.Fatalf("empty name: %d", r.status)
	}
}

func TestWishlist(t *testing.T) {
	s := newStack(t, "dev")
	if r := s.do(s.client(), "GET", "/api/wishlist", nil); r.status != 401 {
		t.Fatalf("guest wishlist: %d", r.status)
	}
	a, b := s.signedIn("wa@example.test"), s.signedIn("wb@example.test")
	var id int64
	if err := s.pool.QueryRow(context.Background(), `SELECT id FROM products ORDER BY id LIMIT 1`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	path := fmt.Sprintf("/api/wishlist/%d", id)
	s.do(a, "PUT", path, nil)
	if r := s.do(a, "PUT", path, nil); r.status != 200 || len(r.body["items"].([]any)) != 1 {
		t.Fatalf("adding twice must keep one item: %v", r.body)
	}
	if r := s.do(b, "GET", "/api/wishlist", nil); len(r.body["items"].([]any)) != 0 {
		t.Fatal("wishlists must be per user")
	}
	if r := s.do(a, "PUT", "/api/wishlist/999999999", nil); r.status != 404 {
		t.Fatalf("unknown product: %d", r.status)
	}
	if r := s.do(a, "DELETE", path, nil); r.status != 200 || len(r.body["items"].([]any)) != 0 {
		t.Fatalf("remove: %v", r.body)
	}
}
