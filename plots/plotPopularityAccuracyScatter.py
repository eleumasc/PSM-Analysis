from core import data, output
import matplotlib.pyplot as plt

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

plt.figure(figsize=(8, 6))

for i in range(num_buckets):
    offset = i * bucket_size
    x = x_centers[i]
    accuracy_values = getAccuracyValues(bucket_size, offset)
    plt.scatter([x] * len(accuracy_values), accuracy_values, color="blue", alpha=0.6)

plt.xticks(x_edges[::2], rotation=90)
plt.xlabel("Popularity (Rank Ranges)")
plt.ylabel("Accuracy")
plt.title("Popularity of Registration Pages vs Accuracy of PSMs")
plt.grid(True, linestyle="--", alpha=0.4)
plt.tight_layout()

output(plt, "popularity-accuracy-scatter.pdf")
