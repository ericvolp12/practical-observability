SHELL=/bin/bash

.DEFAULT_GOAL := help
help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Run mdbook to build content
	docker run --rm -v $(PWD):/book peaceiris/mdbook:v0.4.21 build

dev: ## Run mdbook locally and serve content at http://localhost:3050/ with live reloading
	docker run --rm -it -v $(PWD):/book -p 3050:3000 peaceiris/mdbook:v0.4.21 serve -n 0.0.0.0
