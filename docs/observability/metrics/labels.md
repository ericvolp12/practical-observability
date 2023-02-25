# Labels

In most metrics systems, metrics are stored as multi-dimensional time series where the primary dimension is the observed value at a given time.

Labels are additional categorical dimensions for a metric that allow you to differentiate observations by some property.

Example of labels for metrics are as follows:

| Metric                                 | Label                                                 |
| -------------------------------------- | ----------------------------------------------------- |
| CPU Utilization of a system            | Kubernetes Pod Name for each instance of the system   |
| Latency of handling an HTTP Request    | Status code of the HTTP response                      |
| Number of requests served by a service | Path requested by the user (not including parameters) |

## Label Cardinality

Each metric can have any number of Labels, but for each unique value of a Label, your metrics system will need to create and maintain a whole new time series to track the Label-specific dimension of the metric.

Given the example label of `Status code of the HTTP response`, if our initial metric is a simple time series like `Number of requests served by a service`, then by adding the status code Label, we're potentially creating hundreds of new time series to track our metric, one for each HTTP Status Code that can be reported by our system. Let's say that our service only uses 20 HTTP response codes, that label gets us to 20 time series (one per _unique_ label value) since our original metric is a [Counter](#counter) that only requires one initial time series to track.

When adding a second label like `Kubernetes Pod Name for each instance of the system`, we aren't adding one new time series for each Pod Name but are multiplying our existing time series by the number of unique values for this new label. In this case, if we have 10 pods each running an instance of our service, we'll end up with `1 * 20 * 10 = 200` time series for our metric.

You can see how a metric with 8 labels each with 5 unique values can quickly add up, and adding just one extra label to a metric with many existing labels quickly becomes unsustainable:

$$1*5^{8} = 32{,}768$$

$$1*5^{9} = 1{,}953{,}125$$

> The _uniqueness_ of a label value can be described by the term _cardinality_ where a _high cardinality_ label would have _many_ unique values and a _low cardinality_ label would have _few_ unique values.

An example _high cardinality_ label could be something like `IP Address of Requester` for a web service with many unique users (cardinality equal to number of unique users).

An example _low cardinality_ label could be something like `HTTP Status Group (2xx,3xx,4xx,5xx) of Response` for a web service (cardinality of 4).

## Metric Dimensionality

> The cost of a metric is generally proportional to its _dimensionality_ where the _dimensionality_ of a metric is the total number of time series required to keep track of the metric and its labels. 

In our example above, our `Number of requests served by a service` metric has a dimensionality of `1 * 20 * 10 = 200` meaning we need 200 time series in our metric system to track the metric. If we changed the `Status code of the HTTP response` label to be a `HTTP Status Group (2xx,3xx,4xx,5xx) of Response` label, our dimensionality would reduce to `1 * 4 * 10 = 40` time series which significantly reduces the cost of tracking this metric.

Higher Dimensionality metrics provide more detail and help answer more specific questions, but they do so at the cost of maintaining significantly more time series (which each have an ongoing storage and processing cost). Save High Dimensionality metrics for the things that really need a high level of detail, while picking _low cardinality_ Labels for generic metrics to keep dimensionality low. There are always tradeoffs in observability between cost and detail and Metric Dimensionality is one of the best examples of such a tradeoff.
