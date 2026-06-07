# Transformer Architecture Overview

This document describes the Transformer model architecture and its components.

## Performance Comparison

The following table compares different model architectures on standard benchmarks.

| Model | Accuracy | Speed (ms) | Parameters |
|-------|----------|------------|------------|
| BERT  | 0.91     | 100        | 110M       |
| GPT-2 | 0.89     | 150        | 117M       |
| T5    | 0.93     | 200        | 220M       |
| ViT   | 0.88     | 80         | 86M        |

Text continues after the performance table. This section discusses the findings.

## Attention Mechanisms

Attention allows the model to focus on relevant parts of the input sequence.
Self-attention computes relationships between all pairs of positions.

### Complexity Table

| Layer Type | Complexity per Layer | Sequential Ops | Max Path Length |
|------------|---------------------|----------------|-----------------|
| Self-Attention | O(n²·d) | O(1) | O(1) |
| Recurrent | O(n·d²) | O(n) | O(n) |
| Convolutional | O(k·n·d²) | O(1) | O(log_k(n)) |

## Conclusion

The Transformer architecture demonstrates superior performance across many tasks.
Multi-head attention is the core innovation enabling parallelism and long-range dependencies.
