# Instrumenting an Echo App

Let's build the example service again, this time with Echo:

## Example Echo Service

```go
package main

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// User is a struct representing a user object
type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

var users []User

func main() {
	e := echo.New()
	e.GET("/users", listUsers)
	e.POST("/users", createUser)
	e.Start(":8080")
}

func listUsers(c echo.Context) error {
	// List all users
	return c.JSON(http.StatusOK, users)
}

func createUser(c echo.Context) error {
	// Create a new user
	var user User
	if err := c.Bind(&user); err != nil {
		return err
	}
	users = append(users, user)
	return c.JSON(http.StatusOK, user)
}
```

This time around the only thing we need to be wary of is that Echo uses the `Content-Type` header on requests in the `c.Bind()` method, so if we don't specify that our payload with the `Content-Type: application/json` header, the `c.Bind()` method will return an empty `User` object and add that to the user list.

## Instrumenting Echo with Prometheus Middleware

Echo has a standard [Prometheus Instrumentation Middleware](https://echo.labstack.com/middleware/prometheus/) included in its `contrib` library that we can add to our existing application.

Import the middleware library from `echo-contrib`:

```go
import (
	"net/http"

    "github.com/labstack/echo-contrib/prometheus"
	"github.com/labstack/echo/v4"
)
```

Then enable the metrics middleware inside the `main()` func:

```go
func main() {
	e := echo.New()
    // Enable metrics middleware
    p := prometheus.NewPrometheus("echo", nil)
    p.Use(e)
	e.GET("/users", listUsers)
	e.POST("/users", createUser)
	e.Start(":8080")
}
```

We can start up our server listening on port `8080` with:

```shell
go run main.go
```

Let's run our suite of `curl` requests (slightly modified to include `Content-Type` headers) and see what the `/metrics` endpoint has for us:

```shell
$ curl http://localhost:8080/users
> null
$ curl -X POST -d'{"name":"Eric","id":1}' \
    -H 'Content-Type: application/json' \
    http://localhost:8080/users
> {"id":1,"name":"Eric"}
$ curl http://localhost:8080/users
> [{"id":1,"name":"Eric"}]
$ curl -X POST -d'{"name":' \
    -H 'Content-Type: application/json' \
    http://localhost:8080/users
> {"message":"unexpected EOF"}
```

With some data in place, we can `GET` the `/metrics` endpoint to see our histograms.

I'll collapse the results below because Echo generates lots of histograms by default and with just our four requests we have > 130 lines of metrics.

<details>
<summary>
Metrics Response
</summary>

```shell
$ curl http://localhost:8080/metrics
> # HELP echo_request_duration_seconds The HTTP request latencies in seconds.
> # TYPE echo_request_duration_seconds histogram
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="0.005"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="0.01"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="0.025"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="0.05"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="0.1"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="0.25"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="0.5"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="1"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="2.5"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="5"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="10"} 2
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="+Inf"} 2
> echo_request_duration_seconds_sum{code="200",method="GET",url="/users"} 0.00010224
> echo_request_duration_seconds_count{code="200",method="GET",url="/users"} 2
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="0.005"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="0.01"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="0.025"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="0.05"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="0.1"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="0.25"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="0.5"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="1"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="2.5"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="5"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="10"} 1
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="+Inf"} 1
> echo_request_duration_seconds_sum{code="200",method="POST",url="/users"} 9.14e-05
> echo_request_duration_seconds_count{code="200",method="POST",url="/users"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="0.005"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="0.01"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="0.025"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="0.05"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="0.1"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="0.25"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="0.5"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="1"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="2.5"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="5"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="10"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="+Inf"} 1
> echo_request_duration_seconds_sum{code="400",method="POST",url="/users"} 4.864e-05
> echo_request_duration_seconds_count{code="400",method="POST",url="/users"} 1
> # HELP echo_request_size_bytes The HTTP request sizes in bytes.
> # TYPE echo_request_size_bytes histogram
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="1024"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="2048"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="5120"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="10240"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="102400"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="512000"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="1.048576e+06"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="2.62144e+06"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="5.24288e+06"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="1.048576e+07"} 2
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="+Inf"} 2
> echo_request_size_bytes_sum{code="200",method="GET",url="/users"} 122
> echo_request_size_bytes_count{code="200",method="GET",url="/users"} 2
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="1024"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="2048"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="5120"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="10240"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="102400"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="512000"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="1.048576e+06"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="2.62144e+06"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="5.24288e+06"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="1.048576e+07"} 1
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="+Inf"} 1
> echo_request_size_bytes_sum{code="200",method="POST",url="/users"} 128
> echo_request_size_bytes_count{code="200",method="POST",url="/users"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="1024"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="2048"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="5120"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="10240"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="102400"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="512000"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="1.048576e+06"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="2.62144e+06"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="5.24288e+06"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="1.048576e+07"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="+Inf"} 1
> echo_request_size_bytes_sum{code="400",method="POST",url="/users"} 113
> echo_request_size_bytes_count{code="400",method="POST",url="/users"} 1
> # HELP echo_requests_total How many HTTP requests processed, partitioned by status code and HTTP method.
> # TYPE echo_requests_total counter
> echo_requests_total{code="200",host="localhost:8080",method="GET",url="/users"} 2
> echo_requests_total{code="200",host="localhost:8080",method="POST",url="/users"} 1
> echo_requests_total{code="400",host="localhost:8080",method="POST",url="/users"} 1
> # HELP echo_response_size_bytes The HTTP response sizes in bytes.
> # TYPE echo_response_size_bytes histogram
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="1024"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="2048"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="5120"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="10240"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="102400"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="512000"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="1.048576e+06"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="2.62144e+06"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="5.24288e+06"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="1.048576e+07"} 2
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="+Inf"} 2
> echo_response_size_bytes_sum{code="200",method="GET",url="/users"} 30
> echo_response_size_bytes_count{code="200",method="GET",url="/users"} 2
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="1024"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="2048"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="5120"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="10240"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="102400"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="512000"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="1.048576e+06"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="2.62144e+06"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="5.24288e+06"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="1.048576e+07"} 1
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="+Inf"} 1
> echo_response_size_bytes_sum{code="200",method="POST",url="/users"} 23
> echo_response_size_bytes_count{code="200",method="POST",url="/users"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="1024"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="2048"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="5120"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="10240"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="102400"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="512000"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="1.048576e+06"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="2.62144e+06"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="5.24288e+06"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="1.048576e+07"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="+Inf"} 1
> echo_response_size_bytes_sum{code="400",method="POST",url="/users"} 0
> echo_response_size_bytes_count{code="400",method="POST",url="/users"} 1
```

</details>

## Breaking Down Echo's Metrics

Let's break down the histograms we got back from Echo's Prometheus middleware:

### Response Time Histograms

```shell
> # HELP echo_request_duration_seconds The HTTP request latencies in seconds.
> # TYPE echo_request_duration_seconds histogram
> echo_request_duration_seconds_bucket{code="200",method="GET",url="/users",le="0.005"} 2
> echo_request_duration_seconds_bucket{code="200",method="POST",url="/users",le="0.005"} 1
> echo_request_duration_seconds_bucket{code="400",method="POST",url="/users",le="0.005"} 1
```

We see a request latency histogram for each of our `status`, `method`, `path` combinations similar to the one we created previously, but note that these seem to be using the `DefBuckets` for bucket delineations and `seconds` as the measured value.

::: tip **Review of `DefBuckets`**
```go
// DefBuckets are the default Histogram buckets. The default buckets are
// tailored to broadly measure the response time (in seconds) of a network
// service. Most likely, however, you will be required to define buckets
// customized to your use case.
var DefBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10}
```
:::

All of our requests, being faster than 5 milliseconds, are counted in the smallest latency buckets and we don't have good precision where it counts here. Review the [Tuning Bucket Selection](simple_service.md#assessing-performance-and-tuning-histogram-bucket-selection) section for a discussion on why and how we want our requests to fall somewhere in the middle of our bucket range. Without the use of custom instrumentation middleware, we won't be able to track our quick response timings precisely.

### Request and Response Size Histograms

```shell
> # HELP echo_request_size_bytes The HTTP request sizes in bytes.
> # TYPE echo_request_size_bytes histogram
> echo_request_size_bytes_bucket{code="200",method="GET",url="/users",le="1024"} 2
> echo_request_size_bytes_bucket{code="200",method="POST",url="/users",le="1024"} 1
> echo_request_size_bytes_bucket{code="400",method="POST",url="/users",le="1024"} 1
> ...
> # HELP echo_response_size_bytes The HTTP response sizes in bytes.
> # TYPE echo_response_size_bytes histogram
> echo_response_size_bytes_bucket{code="200",method="GET",url="/users",le="1024"} 2
> echo_response_size_bytes_bucket{code="200",method="POST",url="/users",le="1024"} 1
> echo_response_size_bytes_bucket{code="400",method="POST",url="/users",le="1024"} 1
```

Looking at the rest of the histograms, we're also tracking request size and response size for each of our `status`, `method`, `path` combinations.

These metrics are counting size in `bytes` with a bucket range from `1024` bytes or `1KiB` (note we're talking about Kibibytes here) to `1.048576e+07` bytes or `10MiB` (also note we're talking about Mebibytes here).

Since our requests and responses are much smaller than `1KiB` for our sample app, all of our requests and responses fall into the smallest size buckets. Without the use of custom instrumentation middleware, we won't be able to track our small request sizes precisely.

### Request Counters

Finally let's have a look at the counters.

It seems like Echo is also providing a convenient `Counter` metric type for each of our `status`, `method`, `path` combinations. While we could pull these same numbers from the `..._count` series on any of our previous histograms, there is still a level of convenience in having an explicit request counter metric when exploring metrics with a tool like PromQL or in Grafana.

```shell
> # HELP echo_requests_total How many HTTP requests processed, partitioned by status code and HTTP method.
> # TYPE echo_requests_total counter
> echo_requests_total{code="200",host="localhost:8080",method="GET",url="/users"} 2
> echo_requests_total{code="200",host="localhost:8080",method="POST",url="/users"} 1
> echo_requests_total{code="400",host="localhost:8080",method="POST",url="/users"} 1
```

## Adding Custom Metrics to Echo's Prometheus Instrumentation

Echo's included Prometheus Instrumentation middleware contains support for additional custom metrics. The patterns they establish in their metrics middleware allow you to define metrics where you wire up your API, then pass the custom metrics into the request's `echo.Context` so you can decide in any of your handlers when you want to Observe a new metric value.

I won't dive into this pattern in these docs here as it's a bit out of scope, but you can read Echo's documentation and code example for custom metrics [here](https://echo.labstack.com/middleware/prometheus/#serving-custom-prometheus-metrics).

## Conclusion

Clearly having a standard and framework-supported package for instrumenting your API routes can take a lot of the work of building custom middleware off of your plate; it only took three lines of code to add some solid baseline metrics to our Echo API.

If the unit precision and bucket spacing works for the requests and responses handled by your service, then that's awesome! Much less work for you!

That being said, for our example service (and potentially for services you might be running in production), the default units of measurement and bucket spacings were insufficient to precisely measure both the response times of our routes, and the sizes of both requests and responses.

Without writing custom Echo middleware to instrument our service or potentially leveraging the advanced configuration options for the `echo-contrib/prometheus` package, these metrics will leave us hanging in an incident and fail to provide additional insight into our service.

This demonstrates an important lesson: _off-the-shelf instrumentation libraries may save you time upfront, but if you don't double check that the defaults are good enough for your use-case you'll end up feeling the pain when triaging incidents_.
