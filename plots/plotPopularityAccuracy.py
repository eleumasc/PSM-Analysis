from core import data, output
import matplotlib.pyplot as plt
import numpy as np

bucket_size = 1000
num_buckets = 50


def getAccuracyValues(size, offset):
    return [
        registerPage["maxAccuracyPsfDetail"]["accuracy"]
        for cluster in data["psmClusters"]
        for registerPage in cluster
        if any(
            site["rank"] >= offset and site["rank"] < offset + size
            for site in registerPage["sites"]
        )
    ]


x_edges = [i * bucket_size for i in range(num_buckets + 1)]
x_centers = [x_edges[i] + bucket_size / 2 for i in range(num_buckets)]

means = []
conf_intervals = []

for i in range(num_buckets):
    offset = i * bucket_size
    accuracy_values = getAccuracyValues(bucket_size, offset)
    if accuracy_values:
        mean = np.mean(accuracy_values)
        sem = np.std(accuracy_values, ddof=1) / np.sqrt(len(accuracy_values))
        ci = 1.96 * sem  # 95% confidence interval
    else:
        mean = np.nan
        ci = 0
    means.append(mean)
    conf_intervals.append(ci)

plt.figure(figsize=(8, 6))
plt.errorbar(
    x_centers,
    means,
    yerr=conf_intervals,
    fmt="o",
    color="blue",
    ecolor="lightblue",
    elinewidth=2,
    capsize=4,
    label="Mean Accuracy ± 95% CI",
)

plt.xticks(x_edges[::2], rotation=90)
plt.xlabel("Popularity (Rank Ranges)")
plt.ylabel("Accuracy")
plt.title("Popularity of Registration Pages vs Accuracy of PSMs")
plt.grid(True, linestyle="--", alpha=0.4)
plt.tight_layout()
plt.legend()

output(plt, "popularity-accuracy.pdf")
