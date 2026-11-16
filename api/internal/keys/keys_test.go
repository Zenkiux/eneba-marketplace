package keys

import (
	"bytes"
	"testing"
)

func TestSealOpenRoundTrip(t *testing.T) {
	b, err := NewBox(bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	s1, _ := b.Seal("DEMO-AAAAA-BBBBB-CCCCC")
	s2, _ := b.Seal("DEMO-AAAAA-BBBBB-CCCCC")
	if bytes.Equal(s1, s2) {
		t.Fatal("same plaintext must not give the same ciphertext (random nonce)")
	}
	got, err := b.Open(s1)
	if err != nil || got != "DEMO-AAAAA-BBBBB-CCCCC" {
		t.Fatalf("open = %q, %v", got, err)
	}
	s1[len(s1)-1] ^= 1
	if _, err := b.Open(s1); err == nil {
		t.Fatal("tampered ciphertext must fail")
	}
	if !bytes.Equal(b.Fingerprint("x"), b.Fingerprint("x")) || bytes.Equal(b.Fingerprint("x"), b.Fingerprint("y")) {
		t.Fatal("fingerprint must be deterministic and distinct")
	}
}
