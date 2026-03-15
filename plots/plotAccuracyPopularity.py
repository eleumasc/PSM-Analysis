from core import data, output
import matplotlib.pyplot as plt
import numpy as np

bucket_size = 10000
num_buckets = 5
accuracy_bins = np.linspace(0, 1, 5)

heatmap = np.zeros((num_buckets, len(accuracy_bins) - 1))

for i in range(num_buckets):
    lo, hi = i * bucket_size, (i + 1) * bucket_size

    acc = [
        rp["maxPsfDetail"]["accuracy"]
        for cluster in data["psmClusters"]
        for rp in cluster
        for site in rp["sites"]
        if lo <= site["rank"] < hi
    ]

    if acc:
        heatmap[i], _ = np.histogram(acc, bins=accuracy_bins)

max_count = np.max(heatmap)

fig, ax = plt.subplots(figsize=(8, 6))
extent = [
    accuracy_bins[0],
    accuracy_bins[-1],
    0,
    num_buckets * bucket_size
]

im = ax.imshow(
    heatmap,
    extent=extent,
    origin="lower",
    cmap="coolwarm",
    aspect="auto",
    vmin=0,
    vmax=max_count
)

for y in range(0, (num_buckets + 1) * bucket_size, bucket_size):
    ax.axhline(y, color="white", lw=0.5, alpha=0.3)

for x in accuracy_bins:
    ax.axvline(x, color="white", lw=0.5, alpha=0.3)

cbar = fig.colorbar(im)
cbar.set_label("Number of Websites")

x_centers = (accuracy_bins[:-1] + accuracy_bins[1:]) / 2
y_centers = np.arange(num_buckets) * bucket_size + bucket_size / 2

for i, y in enumerate(y_centers):
    for j, x in enumerate(x_centers):
        count = int(heatmap[i, j])
        if count > 0:
            ax.text(
                x, y,
                f"{count:,}",
                ha="center",
                va="center",
                color="white",
                fontsize=8
            )

ax.set(
    xticks=accuracy_bins,
    yticks=[i * bucket_size for i in range(num_buckets + 1)],
    xlabel="Accuracy",
    ylabel="Popularity (Rank Bucket)",
    title="Accuracy Distribution over Website Popularity"
)

ax.invert_yaxis()
fig.tight_layout()

output(plt, "accuracy-popularity.pdf")
