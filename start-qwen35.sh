#!/bin/bash

set -e

MODEL_DIR="/Volumes/Sandisk/Models/Codding_Model"
PORT="8080"
HOST="127.0.0.1"

echo "=========================================="
echo " Qwen3.5-2B Local Coding Server"
echo "=========================================="

# Find Q8 model
MODEL=$(find "$MODEL_DIR" -type f \
    \( -iname "*Qwen3.5*2B*Q8_0*.gguf" -o -iname "*Qwen3.5-2B-Q8_0.gguf" \) \
    | head -n 1)

if [ -z "$MODEL" ]; then
    echo "ERROR: Qwen3.5-2B-Q8_0.gguf not found."
    echo "Expected directory:"
    echo "$MODEL_DIR"
    exit 1
fi

echo ""
echo "Model:"
echo "$MODEL"
echo ""

# Make sure llama-server exists
if ! command -v llama-server >/dev/null 2>&1; then
    echo "ERROR: llama-server not found."
    echo "Install with:"
    echo "brew install llama.cpp"
    exit 1
fi

echo "Starting local OpenAI-compatible API..."
echo ""
echo "API:"
echo "http://$HOST:$PORT/v1"
echo ""

exec llama-server \
    -m "$MODEL" \
    --host "$HOST" \
    --port "$PORT" \
    --alias "Qwen3.5-2B-Q8_0" \
    -ngl 99 \
    -c 4096 \
    -n 1024 \
    -b 64 \
    -ub 32 \
    -np 1 \
    -fa auto \
    --temp 0.2 \
    --top-p 0.9 \
    --top-k 20 \
    --min-p 0.05 \
    --repeat-penalty 1.05 \
    --no-context-shift