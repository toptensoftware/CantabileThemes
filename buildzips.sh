#!/bin/sh
rm -rf ./Build
mkdir -p ./Build
zip -0 -j ./Build/Light.theme Light.theme/*
zip -0 -j ./Build/Dark.theme Dark.theme/*