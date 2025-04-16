from core import data, output
import matplotlib.pyplot as plt
import numpy as np

bucket_size = 5000
num_buckets = 10
accuracy_bins = np.linspace(-1.0, 1.0, 21)


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


heatmap = np.zeros((20, num_buckets))

for i in range(num_buckets):
    offset = i * bucket_size
    accuracy_values = getAccuracyValues(bucket_size, offset)
    if not accuracy_values:
        continue
    hist, _ = np.histogram(accuracy_values, bins=accuracy_bins)
    heatmap[:, i] = hist

plt.figure(figsize=(8, 6))
extent = [0, num_buckets * bucket_size, -1.0, 1.0]
aspect = "auto"

plt.imshow(heatmap, extent=extent, origin="lower", cmap="coolwarm", aspect=aspect)

for i in range(num_buckets + 1):
    x = i * bucket_size
    plt.axvline(x=x, color="white", linewidth=0.5, alpha=0.3)

for y in np.linspace(-1.0, 1.0, 21):
    plt.axhline(y=y, color="white", linewidth=0.5, alpha=0.3)

plt.colorbar(label="Registration Pages")
plt.xticks(ticks=[i * bucket_size for i in range(0, num_buckets + 1)], rotation=90)
plt.yticks(ticks=np.linspace(-1.0, 1.0, 11))
plt.xlabel("Popularity (Rank Range)")
plt.ylabel("Accuracy")
plt.title("Popularity of Registration Pages vs Accuracy of PSMs")
plt.tight_layout()

output(plt, "popularity-accuracy.pdf")
