# Metric Types

This section will draw heavily from the [Prometheus Docs](https://prometheus.io/docs/concepts/metric_types/) and more can be explored there but frankly they don't go super into depth into the mechanics of metric types and do a poor job of consolidating what you _need to know_.

Prometheus's metrics client libraries usually expose metrics for a service at an HTTP endpoint like `/metrics`.

If you visit this endpoint, you will see a newline separated list of metrics like the one below with an optional `HELP` directive describing the metric, a `TYPE` directive describing the Metric Type, and one or more lines of Values for the metric that reflect the immediate values for the given metric.

```
# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 693.63

# HELP process_open_fds Number of open file descriptors.
# TYPE process_open_fds gauge
process_open_fds 16

# HELP api_response_time Latency of handling an HTTP Request
# TYPE api_response_time histogram
api_response_time_bucket{le="0.005"} 1.887875e+06
api_response_time_bucket{le="0.01"} 1.953018e+06
api_response_time_bucket{le="0.025"} 1.979542e+06
api_response_time_bucket{le="0.05"} 1.985364e+06
api_response_time_bucket{le="0.1"} 1.98599e+06
api_response_time_bucket{le="0.25"} 1.986053e+06
api_response_time_bucket{le="0.5"} 1.986076e+06
api_response_time_bucket{le="1"} 1.986084e+06
api_response_time_bucket{le="2.5"} 1.986087e+06
api_response_time_bucket{le="5"} 1.986087e+06
api_response_time_bucket{le="10"} 1.986087e+06
api_response_time_bucket{le="+Inf"} 1.986087e+06
api_response_time_sum 3930.0361077078646
api_response_time_count 1.986087e+06

# HELP go_gc_duration_seconds A summary of the pause duration of garbage collection cycles.
# TYPE go_gc_duration_seconds summary
go_gc_duration_seconds{quantile="0"} 0.000130274
go_gc_duration_seconds{quantile="0.25"} 0.000147971
go_gc_duration_seconds{quantile="0.5"} 0.000155235
go_gc_duration_seconds{quantile="0.75"} 0.000168787
go_gc_duration_seconds{quantile="1"} 0.000272923
go_gc_duration_seconds_sum 0.298708187
go_gc_duration_seconds_count 1815
```

The Prometheus model uses Scraping by default, where some Agent will poll the `/metrics` endpoint every `n` seconds (usually 60 seconds) and record discrete values for every time series described by the endpoint. Because this polling is not continuous, when a metric is updated in your service, it may not create a discrete datapoint until the next time Scraper comes by. This is an optimization that reduces the amount of work needed to be done by both your service and the Scraper, but if you need to create datapoints synchronously (like for a batch job that exits after it finishes whether or not a Scraper has a chance to poll its `/metrics` endpoint), Prometheus has a [Push Gateway](https://prometheus.io/docs/practices/pushing/) pattern. We will dive deeper into [Pushing Metrics](#pushing-metrics) later in this chapter.