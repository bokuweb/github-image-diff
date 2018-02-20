build:
	mkdir -p wasm
	cargo +nightly build --target wasm32-unknown-unknown --release
	wasm-gc target/wasm32-unknown-unknown/release/lcs-image-diff-js.wasm ext/diff.wasm