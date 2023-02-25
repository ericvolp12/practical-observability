SHELL=/usr/bin/env bash
COMPOSE_RUN_NODE = docker-compose run --rm node
COMPOSE_UP_NODE = docker-compose up -d node
COMPOSE_UP_NODE_DEV = docker-compose up node_dev
SERVE_BASE_URL ?= http://node:5173
.DEFAULT_GOAL := help
help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Run mdbook to build content
	docker run --rm -v $(PWD):/book peaceiris/mdbook:v0.4.21 build

# dev: ## Run mdbook locally and serve content at http://localhost:3000/ with live reloading
# 	docker run --rm -it -v $(PWD):/book -p 3000:3000 peaceiris/mdbook:v0.4.21 serve -n 0.0.0.0

dev:
	docker build . -t book
	docker run --rm -it -v $(PWD):/docs -p 5173:5173 book yarn docs:dev --host 0.0.0.0
