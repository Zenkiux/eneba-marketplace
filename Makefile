# Common tasks. Requires Go 1.25+, Node 22+, PostgreSQL 16 running locally.
.PHONY: db api seed web test transcript

db:          ## create local databases
	createdb eneba 2>/dev/null || true; createdb eneba_test 2>/dev/null || true

api:         ## run the API on :8080 (applies migrations)
	cd api && go run ./cmd/server

seed:        ## load demo data (idempotent); use `make seed ARGS=-reset` to wipe first
	cd api && go run ./cmd/seed $(ARGS)

web:         ## run the frontend on :5173 (proxies /api to :8080)
	cd web && npm run dev

test:        ## backend + frontend checks
	cd api && go vet ./... && go test ./...
	cd web && npm run typecheck && npm run lint && npm run lint:css && npm test

transcript:  ## export and verify the AI conversation history
	python3 -I scripts/transcripts/transcripts.py export && python3 -I scripts/transcripts/transcripts.py verify
