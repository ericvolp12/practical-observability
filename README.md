# Practical Observability

A book that covers the application of observability practices.

We cover the topics of Metrics, Tracing, and Logging, as well as how common observability providers implement each of these ecosystems.

You will learn the theory behind different kinds of observability tools, how they are implemented from first principles, and how to instrument new and existing services in a few popular programming languages (Golang and Python).

## Deployment

This book is deployed as a draft in GCS for now:

| **Environment** | **Book Link**                                                                        |
| --------------- | ------------------------------------------------------------------------------------ |
| Draft           | [Practical Observability](https://storage.googleapis.com/ericv-o11y-book/index.html) |

## Development

To run this project locally, simply clone the repository and run `make dev` to bring up a `mdbook` container that exposes the docs at `http://localhost:3000`

You'll need a recent version of Docker in order to run the project.

### Demo Stack Standup

To startup the local demo stack including Prometheus, Grafana, and AlertManager, use the following steps on your local Kubernetes cluster.

Install Helm

```shell
$ brew install helm
```

Install the Helm Prometheus Repo and Charts

```shell
$ helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
$ helm repo add stable https://charts.helm.sh/stable
$ helm repo update
```

Create a Monitoring Namespace for Prometheus components

```shell
$ kubectl create namespace monitoring
```

Run the Prometheus Helm Chart

Note the ports we're assigning to each service, these can be changed if necessary to accomodate your local environment.

```shell
$ helm install kind-prometheus prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --set prometheus.service.nodePort=30000 \
    --set prometheus.service.type=NodePort \
    --set grafana.service.nodePort=31000 \
    --set grafana.service.type=NodePort \
    --set alertmanager.service.nodePort=32000 \
    --set alertmanager.service.type=NodePort \
    --set prometheus-node-exporter.service.nodePort=32001 \
    --set prometheus-node-exporter.service.type=NodePort
```

Patch the Node Exporter to keep it from crashing since it has difficulties with Docker Desktop clusters on occasion:

```shell
$ kubectl patch -n monitoring ds kind-prometheus-prometheus-node-exporter --type "json" -p '[{"op": "remove", "path" : "/spec/template/spec/containers/0/volumeMounts/2/mountPropagation"}]'
```

Check for running Prometheus pods:

```shell
$ kubectl --namespace monitoring get pods -l release=kind-prometheus
NAME                                                   READY   STATUS    RESTARTS   AGE
kind-prometheus-kube-prome-operator-75468846f9-ng4kk   1/1     Running   0          6m14s
kind-prometheus-kube-state-metrics-554c667875-mg27l    1/1     Running   0          6m14s
kind-prometheus-prometheus-node-exporter-l7qng         1/1     Running   0          55s
```

Check the full component stack:

```shell
$ kubectl get all --namespace monitoring

NAME                                                         READY   STATUS    RESTARTS        AGE
pod/alertmanager-kind-prometheus-kube-prome-alertmanager-0   2/2     Running   1 (7m21s ago)   7m43s
pod/kind-prometheus-grafana-59764d785-fq26p                  3/3     Running   0               7m59s
pod/kind-prometheus-kube-prome-operator-75468846f9-ng4kk     1/1     Running   0               7m59s
pod/kind-prometheus-kube-state-metrics-554c667875-mg27l      1/1     Running   0               7m59s
pod/kind-prometheus-prometheus-node-exporter-l7qng           1/1     Running   0               2m40s
pod/prometheus-kind-prometheus-kube-prome-prometheus-0       2/2     Running   0               7m43s

NAME                                               TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)                      AGE
service/alertmanager-operated                      ClusterIP   None             <none>        9093/TCP,9094/TCP,9094/UDP   7m43s
service/kind-prometheus-grafana                    NodePort    10.101.226.52    <none>        80:31000/TCP                 7m59s
service/kind-prometheus-kube-prome-alertmanager    NodePort    10.109.27.17     <none>        9093:32000/TCP               7m59s
service/kind-prometheus-kube-prome-operator        ClusterIP   10.96.108.97     <none>        443/TCP                      7m59s
service/kind-prometheus-kube-prome-prometheus      NodePort    10.105.140.103   <none>        9090:30000/TCP               7m59s
service/kind-prometheus-kube-state-metrics         ClusterIP   10.111.190.206   <none>        8080/TCP                     7m59s
service/kind-prometheus-prometheus-node-exporter   NodePort    10.99.3.90       <none>        9100:32001/TCP               7m59s
service/prometheus-operated                        ClusterIP   None             <none>        9090/TCP                     7m43s

NAME                                                      DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE
daemonset.apps/kind-prometheus-prometheus-node-exporter   1         1         1       1            1           <none>          7m59s

NAME                                                  READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/kind-prometheus-grafana               1/1     1            1           7m59s
deployment.apps/kind-prometheus-kube-prome-operator   1/1     1            1           7m59s
deployment.apps/kind-prometheus-kube-state-metrics    1/1     1            1           7m59s

NAME                                                             DESIRED   CURRENT   READY   AGE
replicaset.apps/kind-prometheus-grafana-59764d785                1         1         1       7m59s
replicaset.apps/kind-prometheus-kube-prome-operator-75468846f9   1         1         1       7m59s
replicaset.apps/kind-prometheus-kube-state-metrics-554c667875    1         1         1       7m59s

NAME                                                                    READY   AGE
statefulset.apps/alertmanager-kind-prometheus-kube-prome-alertmanager   1/1     7m43s
statefulset.apps/prometheus-kind-prometheus-kube-prome-prometheus       1/1     7m43s
```

After the install you'll find:

- Prometheus at [`http://localhost:30000`](http://localhost:30000)
- Grafana at [`http://localhost:31000`](http://localhost:31000)
- AlertManager at [`http://localhost:32000`](http://localhost:32000)

Log into Grafana with the following credentials:

```
Username: admin
Password: prom-operator
```

### Teardown

Teardown the stack when you're done with:

```shell
$ kubectl delete namespace monitoring
```

## CI/CD

This repo has one main CI pipeline, that builds and publishes the draft to GCS in a GitHub Action.

Commits to the main branch will trigger a build and deploy and generally within 20 seconds of a push you should see the updated docs at the `Draft` environment link.
