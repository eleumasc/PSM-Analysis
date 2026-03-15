from core import data, output
import matplotlib.pyplot as plt

bucket_size = 2500
num_buckets = 20


def countSites(size, offset):
    return len(
        [
            site
            for registerPage in data["registerPages"]
            for site in registerPage["sites"]
            if site["rank"] >= offset and site["rank"] < offset + size
        ]
    )


def countPSMSites(size, offset):
    return len(
        [
            site
            for cluster in data["psmClusters"]
            for registerPage in cluster
            for site in registerPage["sites"]
            if site["rank"] >= offset and site["rank"] < offset + size
        ]
    )


psm_sites_y_values = []
sites_y_values = []
for i in range(num_buckets):
    offset = i * bucket_size
    psm_sites_y_values.append(countPSMSites(bucket_size, offset))
    sites_y_values.append(countSites(bucket_size, offset))

percentages = [
    (psm / total * 100 if total > 0 else 0)
    for psm, total in zip(psm_sites_y_values, sites_y_values)
]

x_edges = [i * bucket_size for i in range(num_buckets + 1)]
x_centers = [x_edges[i] + bucket_size / 2 for i in range(num_buckets)]

plt.figure(figsize=(8, 6))

plt.bar(
    x_centers,
    percentages,
    width=bucket_size,
    color="purple",
    label="Websites with PSM (%)",
)

plt.xticks(x_edges, rotation=90)
plt.xlabel("Popularity (Rank Bucket)")
plt.ylabel("% of Websites with Registration Page")
plt.title("Percentages of Websites with PSM by Popularity")
plt.grid(True, linestyle="--", alpha=0.4)
plt.tight_layout()
plt.legend()

output(plt, "popularity-psm-sites.pdf")
