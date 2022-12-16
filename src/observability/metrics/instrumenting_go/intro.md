# Go Instrumentation

This chapter will cover the process of adding Prometheus-style metrics instrumentation to your new or existing Go application.

Some of the following examples will be particular to HTTP APIs, but I'll also include an example of instrumenting a batch-style process that exits after completion and a long-running service that may not expose a traditional HTTP API.

## The Go Prometheus Library

Grafana provides a Prometheus metrics [client](https://github.com/prometheus/client_golang) for Golang that has remained remarkably stable over the past 8 years.

While the OpenTelemetry project is incubating a Metrics package to to implement their vendor-agnostic [Metrics Data Model](https://opentelemetry.io/docs/reference/specification/metrics/data-model/), as of this writing, the package is in the [`Alpha`](https://github.com/open-telemetry/opentelemetry-go#project-status) state and is not recommended for general use until it graduates into the `Stable` state because it will likely have several breaking interface revisions before then.

Several other metrics packages have emerged over this time that wrap existing metrics clients like [`go-kit`'s](https://github.com/go-kit/kit/tree/master/metrics) metrics package, but at the end of the day the Prometheus client has remained reliably stable and consistent for years and the formats and patterns it established have helped define what system metrics look like everywhere today.

The package documentation lives [here](https://pkg.go.dev/github.com/prometheus/client_golang/prometheus) and provides a basic starting example and a deeper dive into the full capabilities of the client library, but I'll provide in-depth examples in the following sections.