# Go Instrumentation

This chapter will cover the process of adding Prometheus-style metrics instrumentation to your new or existing Go application.

Some of the following examples will be particular to HTTP APIs, but I'll also include an example of instrumenting a batch-style process that exits after completion and a long-running service that may not expose a traditional HTTP API.

## The Go Prometheus Library

Grafana provides a Prometheus metrics [client](https://github.com/prometheus/client_golang) for Golang that has remained remarkably stable over the past 8 years.

While the OpenTelemetry project is incubating a Metrics package to to implement their vendor-agnostic [Metrics Data Model](https://opentelemetry.io/docs/reference/specification/metrics/data-model/), as of this writing, the package is in the [`Alpha`](https://github.com/open-telemetry/opentelemetry-go#project-status) state and is not recommended for general use until it graduates into the `Stable` state because it will likely have several breaking interface revisions before then.

Several other metrics packages have emerged over this time that wrap existing metrics clients like [`go-kit`'s](https://github.com/go-kit/kit/tree/master/metrics) metrics package, but at the end of the day the Prometheus client has remained reliably stable and consistent for years and the formats and patterns it established have helped define what system metrics look like everywhere today.

The package documentation lives [here](https://pkg.go.dev/github.com/prometheus/client_golang/prometheus) and provides a basic starting example and a deeper dive into the full capabilities of the client library, but I'll provide an example below.

## Instrumenting a Golang-based HTTP Service

Imagine you have a service in Golang that exposes some HTTP API routes and you're interested in tracking some metrics pertaining to these routes. Later we'll cover instrumenting more complex services and using instrumentation packages for common frameworks like Gin and Echo to add some baseline metrics to existing services without having to manually instrument our handlers.

### Defining an Example Service

```go
package main

import (
	"encoding/json"
	"net/http"
)

// User is a struct representing a user object
type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

var users []User

func main() {
	http.HandleFunc("/users", handleUsers)
	http.ListenAndServe(":8080", nil)
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		// List all users
		json.NewEncoder(w).Encode(users)
	case "POST":
		// Create a new user
		var user User
		json.NewDecoder(r.Body).Decode(&user)
		users = append(users, user)
		json.NewEncoder(w).Encode(user)
	default:
		http.Error(
			w,
			http.StatusText(http.StatusMethodNotAllowed),
			http.StatusMethodNotAllowed,
		)
	}
}

```

This code defines a struct called `User` that represents a user object. It has two fields: `ID` and `Name`.

The `main()` function sets up an HTTP server that listens on port `8080` and registers a handler function for requests to the `/users` endpoint.

The `handleUsers()` function is the handler for requests to the `/users` endpoint. It uses a `switch` statement to handle different HTTP methods (`GET`, `POST`, etc.) differently.

For example, when a `GET` request is received, it simply encodes the list of users as JSON and writes it to the response. When a `POST` request is received, it decodes the request body as a `User` object, appends it to the list of users, and then encodes the `User` object as JSON and writes it to the response.

### Instrumenting the Example Service

Metrics we may be interested in tracking include **which routes** are called in a time period, **how many times** they're called, **how long** they take to handle, and **what status code** they return.

> **An Aside on Collectors, Gatherers, and Registries**
> 
> The Prometheus client library initializes one or more Metrics [Registries](https://pkg.go.dev/github.com/prometheus/client_golang/prometheus#Registry) which are then periodically Collected, Gathered, and Exposed generally via an HTTP route like `/metrics` for scraping via library-managed goroutines.
>
> For our purposes, we can generally rely on the implicit Global Registry to register our metrics and use the `promauto` package to initialize our Collectors behind the scenes. If you are a power user that wants to dig deeper into building custom Metrics Registries, Collectors or Gatherers, you can take a deeper dive into the docs [here](https://pkg.go.dev/github.com/prometheus/client_golang/prometheus#hdr-Advanced_Uses_of_the_Registry).

We'll import three packages at the top of our file:

```go
import (
        //...
        "github.com/prometheus/client_golang/prometheus"
        "github.com/prometheus/client_golang/prometheus/promauto"
        "github.com/prometheus/client_golang/prometheus/promhttp"
)
```

The `prometheus` package is our client library, `promauto` handles registries and collectors for us, and `promhttp` will let us export our metrics to a provided HTTP Handler function so that our metrics can be scraped from `/metrics`.

#### Registering Metrics and Scraping Handler

Now we can initialize a `CounterVec` to keep track of calls to our API routes and use some labels on the counter to differentiate between the HTTP Method being used (`POST` vs `GET`).

A `CounterVec` is a group of `Counter` metrics that may have different label values, if we just used a `Counter` we'd have to define a different metric for each distinct label value.

When initializing the `CounterVec` we provide the `keys` or names of the labels in advance for registration, while the label `values` can be defined dynamically in our application when recording a metric observation.

Let's initialize our `reqCounter` `CounterVec` above the `main()` function and use the `promhttp` library to expose our metrics on `/metrics`:

```go
//...
var users []User

// Define the CounterVec to keep track of Total Number of Requests
// Also declare the labels names "method" and "path"
var reqCounter = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "userapi_requests_handled_total",
	Help: "The total number of handled requests",
}, []string{"method", "path"})

func main() {
    // Expose Prometheus Metrics on /metrics
    http.Handle("/metrics", promhttp.Handler())

    // Register API route handlers
	http.HandleFunc("/users", handleUsers)

    // Startup the HTTP server on port 8080
	http.ListenAndServe(":8080", nil)
}
//...
```

#### Recording Observations of Custom Metrics

Finally we'll want to update our `handleUsers()` function to increment the `Counter` with the proper labels when we get requests as follows:

```go
//...
func handleUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		// Increment the count of /users GETs
		reqCounter.With(prometheus.Labels{"method": "GET", "path": "/users"}).Inc()
		// List all users
		json.NewEncoder(w).Encode(users)
	case "POST":
		// Increment the count of /users POSTs
		reqCounter.With(prometheus.Labels{"method": "POST", "path": "/users"}).Inc()
		// Create a new user
		var user User
		json.NewDecoder(r.Body).Decode(&user)
		users = append(users, user)
		json.NewEncoder(w).Encode(user)
	default:
		http.Error(
			w,
			http.StatusText(http.StatusMethodNotAllowed),
			http.StatusMethodNotAllowed,
		)
	}
}
```

#### Testing our Instrumentation

Let's test our results by running the server, hitting the endpoints a few times, then watching the `/metrics` endpoint to see how it changes:

```shell
go run main.go
```

In another tab we can use `curl` to talk to the server at `http://localhost:8080`

```shell
$ # GET our /users route
$ curl http://localhost:8080/users
> null
```
```shell
$ # Check the /metrics endpoint to see if our metric appears
$ curl http://localhost:8080/metrics
> ...
> # HELP userapi_requests_handled_total The total number of handled requests
> # TYPE userapi_requests_handled_total counter
> userapi_requests_handled_total{method="GET",path="/users"} 1
```

Note that we see a single time series under the `userapi_requests_handled_total` heading with the label values specified in our `GET` handler.

```shell
$ # POST a new user and then fetch it
$ curl -X POST -d'{"name":"Eric","id":1}' http://localhost:8080/users
> {"id":1,"name":"Eric"}
$ curl http://localhost:8080/users
> [{"id":1,"name":"Eric"}]
```

We've made two more requests now, a `POST` and an additional `GET`.

```shell
$ # Check the /metrics endpoint again
$ curl http://localhost:8080/metrics
> ...
> # HELP userapi_requests_handled_total The total number of handled requests
> # TYPE userapi_requests_handled_total counter
> userapi_requests_handled_total{method="GET",path="/users"} 2
> userapi_requests_handled_total{method="POST",path="/users"} 1
```

And we can see that the `POST` handler incremented its counter for the first time so now it shows up in the `/metrics` route as well.

#### Expanding our Instrumentation

Let's add the additional metrics we discussed, we're still interested in understanding the response time for each endpoint as well as the status code of each request.

We can add an additional label to our existing `CounterVec` to record the status code of responses as follows:

```go
//...
// Define the CounterVec to keep track of Total Number of Requests
// Also declare the labels names "method", "path", and "status"
var reqCounter = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "userapi_requests_handled_total",
	Help: "The total number of handled requests",
}, []string{"method", "path", "status"})
//...

func handleUsers(w http.ResponseWriter, r *http.Request) {
    // Keep track of response status
	status := http.StatusOK
	switch r.Method {
	case "GET":
		// List all users
		err := json.NewEncoder(w).Encode(users)

		// Return an error if something goes wrong
		if err != nil {
			http.Error(
				w,
				http.StatusText(http.StatusInternalServerError),
				http.StatusInternalServerError,
			)
			status = http.StatusInternalServerError
		}
		// Increment the count of /users GETs
		reqCounter.With(prometheus.Labels{
			"method": "GET",
			"path":   "/users",
			"status": fmt.Sprintf("%d", status),
		}).Inc()
	case "POST":
		// Create a new user
		var user User
		err := json.NewDecoder(r.Body).Decode(&user)
		// Return an error if we fail to decode the body
		if err != nil {
			http.Error(
				w,
				http.StatusText(http.StatusBadRequest),
				http.StatusBadRequest,
			)
			status = http.StatusBadRequest
		} else {
			users = append(users, user)
			err = json.NewEncoder(w).Encode(user)

			// Return an error if can't encode the user for a response
			if err != nil {
				http.Error(
					w,
					http.StatusText(http.StatusInternalServerError),
					http.StatusInternalServerError,
				)
				status = http.StatusInternalServerError
			}
		}
		// Increment the count of /users POSTs
		reqCounter.With(prometheus.Labels{
			"method": "POST",
			"path":   "/users",
			"status": fmt.Sprintf("%d", status),
		}).Inc()
	default:
		http.Error(
			w,
			http.StatusText(http.StatusMethodNotAllowed),
			http.StatusMethodNotAllowed,
		)
	}
}
```

You can see here our code is beginning to look like it needs some refactoring, this is where frameworks like Gin and Echo can be very useful, they provide middleware interfaces that allow you to run handler hooks before and/or after the business logic of a request handler so we could instrument inside a middleware instead.

Running the same series of requests as before through our application now gives us the following response on the `/metrics` endpoint:

```shell
$ # Check the /metrics endpoint
$ curl http://localhost:8080/metrics
> ...
> # HELP userapi_requests_handled_total The total number of handled requests
> # TYPE userapi_requests_handled_total counter
> userapi_requests_handled_total{method="GET",path="/users",status="200"} 2
> userapi_requests_handled_total{method="POST",path="/users",status="200"} 1
```

We can then trigger an error by providing invalid JSON to the `POST` endpoint:

```shell
$ curl -X POST -d'{"name":}' http://localhost:8080/users
> Bad Request
```

And if we check the `/metrics` endpoint again we should see a new series with the status value of `400`:

```shell
$ # Check the /metrics endpoint again
$ curl http://localhost:8080/metrics
> ...
> # HELP userapi_requests_handled_total The total number of handled requests
> # TYPE userapi_requests_handled_total counter
> userapi_requests_handled_total{method="GET",path="/users",status="200"} 2
> userapi_requests_handled_total{method="POST",path="/users",status="200"} 1
> userapi_requests_handled_total{method="POST",path="/users",status="400"} 1
```

#### Using Histograms to Track Latency

Fantastic! Now we have **which routes** are called in a time period, **how many times** they're called, and **what status code** they return. All we're missing is **how long** they take to handle, which will require us to use a `Histogram` instead of a `Counter`.

To track response latency, we can refactor our existing metric instead of creating another one since `Histograms` also track the total number of observations in the series, they act as a `CounterVec` with a built-in label for the top boundary of the bucket.

Let's redefine our `reqCounter` and rename it to `reqLatency`:

```go
//...
// Define the HistogramVec to keep track of Latency of Request Handling
// Also declare the labels names "method", "path", and "status"
var reqLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name: "userapi_request_latency_seconds",
	Help: "The latency of handling requests in seconds",
}, []string{"method", "path", "status"})
//...
```

When defining this `HistogramVec`, we have the option to provide `Buckets` in the `HistogramOpts` which determine the thresholds for each bucket in each `Histogram`.

By default, the Prometheus library will use the default bucket list `DefBuckets`:

```go
// DefBuckets are the default Histogram buckets. The default buckets are
// tailored to broadly measure the response time (in seconds) of a network
// service. Most likely, however, you will be required to define buckets
// customized to your use case.
var DefBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10}
```

In our case, we can keep the default buckets as they are, but once we start measuring we might notice our responses are rather quick (since our service is just serving small amounts of data from memory) and may wish to tweak the buckets further. Defining the right buckets ahead of time can save you pain in the future wheen debugging issues that happen above or below the highest and lowest bucket thresholds. Remember the highest bucket being 10 seconds means we record any request that takes longer than 10 seconds as having taken >10 seconds, the lowest threshold being 5 milliseconds means we record any request that takes fewer than 5 milliseconds to serve as having taken <5 milliseconds.

Now we'll update our `handleUsers()` function to time the request duration and record the observations:

```go
//...
func handleUsers(w http.ResponseWriter, r *http.Request) {
	// Record the start time for request handling
	start := time.Now()
	status := http.StatusOK

	switch r.Method {
	case "GET":
		// List all users
		err := json.NewEncoder(w).Encode(users)

		// Return an error if something goes wrong
		if err != nil {
			http.Error(
				w,
				http.StatusText(http.StatusInternalServerError),
				http.StatusInternalServerError,
			)
			status = http.StatusInternalServerError
		}
		// Observe the Seconds we started handling the GET
		reqLatency.With(prometheus.Labels{
			"method": "GET",
			"path":   "/users",
			"status": fmt.Sprintf("%d", status),
		}).Observe(time.Since(start).Seconds())
	case "POST":
		// Create a new user
		var user User
		err := json.NewDecoder(r.Body).Decode(&user)
		// Return an error if we fail to decode the body
		if err != nil {
			http.Error(
				w,
				http.StatusText(http.StatusBadRequest),
				http.StatusBadRequest,
			)
			status = http.StatusBadRequest
		} else {
			users = append(users, user)
			err = json.NewEncoder(w).Encode(user)

			// Return an error if can't encode the user for a response
			if err != nil {
				http.Error(
					w,
					http.StatusText(http.StatusInternalServerError),
					http.StatusInternalServerError,
				)
				status = http.StatusInternalServerError
			}
		}
		// Observe the Seconds we started handling the POST
		reqLatency.With(prometheus.Labels{
			"method": "POST",
			"path":   "/users",
			"status": fmt.Sprintf("%d", status),
		}).Observe(time.Since(start).Seconds())
	default:
		http.Error(
			w,
			http.StatusText(http.StatusMethodNotAllowed),
			http.StatusMethodNotAllowed,
		)
	}
}
```

Note with the `HistogramVec` object we're using the `Observe()` method instead of the `Inc()` method. `Observe()` takes a `float64`, in the case of the default buckets for HTTP latency timing, we'll generally use `Seconds` as the denomination but based on your bucket selection and time domains for the value you're observing, you can technically use any unit you want as long as you're consistent and include it in the help text (and maybe even the metric name).

#### Breaking Down Histogram Bucket Representation

Now we can run our requests from the Status Code example, generating some interesting metrics to view in `/metrics`:

```shell
$ # Check the /metrics endpoint
$ curl http://localhost:8080/metrics
> ...
> # HELP userapi_request_latency_seconds The latency of handling requests in seconds
> # TYPE userapi_request_latency_seconds histogram
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="0.005"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="0.01"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="0.025"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="0.05"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="0.1"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="0.25"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="0.5"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="1"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="2.5"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="5"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="10"} 2
> userapi_request_latency_seconds_bucket{method="GET",path="/users",status="200",le="+Inf"} 2
> userapi_request_latency_seconds_sum{method="GET",path="/users",status="200"} 0.00011795999999999999
> userapi_request_latency_seconds_count{method="GET",path="/users",status="200"} 2
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="0.005"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="0.01"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="0.025"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="0.05"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="0.1"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="0.25"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="0.5"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="1"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="2.5"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="5"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="10"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="200",le="+Inf"} 1
> userapi_request_latency_seconds_sum{method="POST",path="/users",status="200"} 9.3089e-05
> userapi_request_latency_seconds_count{method="POST",path="/users",status="200"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="0.005"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="0.01"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="0.025"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="0.05"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="0.1"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="0.25"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="0.5"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="1"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="2.5"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="5"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="10"} 1
> userapi_request_latency_seconds_bucket{method="POST",path="/users",status="400",le="+Inf"} 1
> userapi_request_latency_seconds_sum{method="POST",path="/users",status="400"} 7.6479e-05
> userapi_request_latency_seconds_count{method="POST",path="/users",status="400"} 1
```

In the response we can see three `Histograms` represented, one for `GET /users` with a `200` status, one for `POST /users` with a `200` status, and a third for `POST /users` with a `400` status.

If we read the counts generated, we can see that each of our requests was too small for the bucket precision we chose. Prometheus records `Histogram` observations by incrementing the counter of every bucket that the observation fits in. 

Each bucket is defined by a `le` label that sets the condition: "every observation where the observation value is less than or equal to my `le` value and every other label value matches mine should increment my counter". Since all `le` buckets have the same values and we know we only executed four requests, each of our requests was quick enough to match the smallest latency bucket. 

#### Assessing Performance and Tuning Histogram Bucket Selection

We can look at the `userapi_request_latency_seconds_sum` values to determine the actual latencies of our requests since these are `float64` counters that increment by the exact `float64` value observed by each histogram.

```shell
> ..._seconds_sum{method="GET",path="/users",status="200"} 0.00011795999999999999
> ..._seconds_count{method="GET",path="/users",status="200"} 2

> ..._seconds_sum{method="POST",path="/users",status="200"} 9.3089e-05
> ..._seconds_count{method="POST",path="/users",status="200"} 1

> ..._seconds_sum{method="POST",path="/users",status="400"} 7.6479e-05
> ..._seconds_count{method="POST",path="/users",status="400"} 1
```

When isolated, we can take the `..._sum` counter for a `Histogram` and divide it by the `..._count` counter to get an average value of all observations in the `Histogram`. 

Our `POST` endpoint with `200` status only has one observation with a request latency of `9.3089e-05` or `93.089` microseconds (not milliseconds). `POST` with status `400` responded in `76.479` microseconds, even quicker. And finally the average of our two `GET` requests comes down to `58.98` microseconds.

Clearly this service is incredibly quick so if we want to accurately measure latencies, we'll need microsecond-level precision in our observations and will want our buckets to measure somewhere from maybe 10 microseconds at the low end to maybe 10 milliseconds at the high-end.

We can update our `HistogramVec` to track `milliseconds` instead of `seconds` and then using the same default buckets we'll be tracking from `0.005` milliseconds (which is 5 microseconds) to `10` milliseconds using the same `DefBuckets`.

Go tracks `Milliseconds` as integers so we'll want to use the `Microseconds` value on our `time.Duration`, cast it to a `float64`, and divide it by `1000` to make it into a `float64` of milliseconds.

```go
//...
// Define the HistogramVec to keep track of Latency of Request Handling
// Also declare the labels names "method", "path", and "status"
var reqLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name: "userapi_request_latency_ms",
	Help: "The latency of handling requests in milliseconds",
}, []string{"method", "path", "status"})
//...
// Observe the Milliseconds we started handling the GET
reqLatency.With(prometheus.Labels{
    "method": "GET",
    "path":   "/users",
    "status": fmt.Sprintf("%d", status),
}).Observe(float64(time.Since(start).Microseconds()) / 1000)
//...
// Observe the Milliseconds we started handling the POST
reqLatency.With(prometheus.Labels{
    "method": "POST",
    "path":   "/users",
    "status": fmt.Sprintf("%d", status),
}).Observe(float64(time.Since(start).Microseconds()) / 1000)
```

Now we can run our requests again and check the `/metrics` endpoint:

```shell
$ # Check the /metrics endpoint
$ curl http://localhost:8080/metrics
> ...
> # HELP userapi_request_latency_ms The latency of handling requests in milliseconds
> # TYPE userapi_request_latency_ms histogram
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.005"} 0
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.01"} 0
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.025"} 0
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.05"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.1"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.25"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.5"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="1"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="2.5"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="5"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="10"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="+Inf"} 2
> userapi_request_latency_ms_sum{method="GET",path="/users",status="200"} 0.082
> userapi_request_latency_ms_count{method="GET",path="/users",status="200"} 2
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.005"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.01"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.025"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.05"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.1"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.25"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="1"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="2.5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="10"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="+Inf"} 1
> userapi_request_latency_ms_sum{method="POST",path="/users",status="200"} 0.087
> userapi_request_latency_ms_count{method="POST",path="/users",status="200"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.005"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.01"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.025"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.05"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.1"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.25"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="1"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="2.5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="10"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="+Inf"} 1
> userapi_request_latency_ms_sum{method="POST",path="/users",status="400"} 0.085
> userapi_request_latency_ms_count{method="POST",path="/users",status="400"} 1
```

Incredible! We can now spot the bucket boundary where our requests fall by looking for the `0->1` or `0->2` transition. When looking at two sequential buckets, the lower `le` label value describes the exclusive lower range of the values while the larger `le` label value describes the inclusive upper range of the bucket.

Our `GET /users 200` requests seem to have both fallen in the `(0.025 - 0.05]` millisecond bucket, which would clock them somewhere between `25` and `50` microseconds. The `POST /users 200` and `POST /users 400` requests fall within the `(0.05 - 0.1]` millisecond bucket which clocks them between `50` and `100` microseconds.

If we look at the `sum` and `count` values for each `Histogram` this time around we can see that the `POST` requests each took around `85` microseconds to handle, and the `GET` request took around `41` microseconds to handle. These results validate our analysis of the Histogram buckets and how we interpret them.