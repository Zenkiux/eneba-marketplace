// Package keys encrypts digital-key codes at rest (AES-256-GCM) and derives a keyed
// fingerprint so the database can reject duplicate codes without storing them in plain text.
package keys

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"errors"
)

type Box struct {
	aead   cipher.AEAD
	macKey []byte
}

func NewBox(key []byte) (*Box, error) {
	if len(key) != 32 {
		return nil, errors.New("key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	m := hmac.New(sha256.New, key)
	m.Write([]byte("fingerprint"))
	return &Box{aead: aead, macKey: m.Sum(nil)}, nil
}

// Seal returns nonce || ciphertext.
func (b *Box) Seal(code string) ([]byte, error) {
	nonce := make([]byte, b.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return b.aead.Seal(nonce, nonce, []byte(code), nil), nil
}

func (b *Box) Open(sealed []byte) (string, error) {
	n := b.aead.NonceSize()
	if len(sealed) < n {
		return "", errors.New("ciphertext too short")
	}
	plain, err := b.aead.Open(nil, sealed[:n], sealed[n:], nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func (b *Box) Fingerprint(code string) []byte {
	m := hmac.New(sha256.New, b.macKey)
	m.Write([]byte(code))
	return m.Sum(nil)
}
