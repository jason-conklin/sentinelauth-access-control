SHELL := /bin/bash

.PHONY: install run test format lint seed docker-up docker-down

install:
	python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

run:
	uvicorn api.main:app --host 0.0.0.0 --port 8001

test:
	pytest -q

seed:
	python scripts/seed_admin.py

docker-up:
	docker compose up --build

docker-down:
	docker compose down
