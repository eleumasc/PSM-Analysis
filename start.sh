#!/bin/bash

docker compose run -e PSM_HOST_DIR="$(pwd)" --rm psm "$@"
