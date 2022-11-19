# Metrics

## What Metrics are Not

Metrics are not a silver bullet to solving all your production issues. In fact, in a world of microservices where each service talks to a number of other services in order to serve a request, metrics can be deceptive, difficult to understand, and are often missing where we need them most because we failed to anticipate what we should have been measuring.

> In a modern world, debugging with metrics requires you to connect dozens of disconnected metrics that were recorded over the course of executing any one particular request, across any number of services or machines, to infer what might have occurred over the various hops needed for its fulfillment. The helpfulness of those dozens of clues depends entirely upon whether someone was able to predict, in advance, if that measurement was over or under the threshold that meant this action contributed to creating a previously unknown anomalous failure mode that had never been previously encountered.[^1]

That being said, metrics can be useful in the process of debugging and triaging production incidents. Metrics provide a helpful summary of the state of a system, and while they may not hold all the answers, they allow us to ask more specific questions which help to guide investigations. Additionally, metrics can be the basis for alerts which provide on-call engineers with early warnings, helping us catch incidents before they impact users.

## What Metrics Are

Metrics are numerical time-series data that describe the state of systems over time.

Common base metrics include the following:
- Latency between receiving a HTTP request and sending a response
- CPU seconds being utilized by a system
- Number of requests being processed by a system
- Size of response bodies being sent by a system
- Number of requests that result in errors being sent by a system

These base metrics are all things we can measure directly in a given system. They don't immediately seem useful in determining if something is wrong with the system but from these core metrics we can _derive_ higher level metrics that indicate when systems may be unhealthy.

Common derived metrics include:
- 95th Percentile of HTTP Request/Response Latency over the past 5 minutes
- Average and Maximum CPU Utilization % across all deployed containers for a system over the past hour
- Request throughput (\\( \frac{req}{s}\\)) being handled by a system over the past 5 minutes
- Ingress and Egress Bandwidth (\\( \frac{MB}{s}\\)) of a system over the past hour
- Error (\\(\frac{failed\ requests}{total\ requests}\\)) rate (\\( \frac{error}{s}\\)) of a system over the past 5 minutes

Derived metrics, when graphed, make it easy to visually pattern match to find outliers in system operation. Derived metrics can also be utilized for alerting when outside of "normal" operating ranges, but generally don't determine directly that there is something wrong with the system.

As engineers, we track base metrics in our systems and expose them for collection regularly so that our observability platform can record the change over time of these base metrics. We pick base metrics that provide measurable truth of the state of the system using absolute values where possible. With a large enough pool of base metrics, we can generate dozens of derived metrics that interpret the base metrics _in context_, making it clear to the viewer both _what_ is being measured and _why_ it is important.


## What _should_ I record with Metrics?

## Pushing Metrics

## How to Produce Metrics via Prometheus

[^1]: Lots of content for these docs is inspired and sometimes directly drawn from Charity Majors, Liz Fong-Jones, and George Miranda's book, ["Observability Engineering"](https://info.honeycomb.io/observability-engineering-oreilly-book-2022)

