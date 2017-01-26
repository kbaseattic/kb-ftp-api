#!/bin/sh

echo "{ \"deployment\" : \"$DEPLOY\" }" > /src/config/env.json

/usr/local/bin/node /src/server.js
