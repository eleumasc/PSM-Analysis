from core import data, output
import matplotlib.pyplot as plt


def countRegisterPages(size, offset):
    return len(
        [
            registerPage
            for registerPage in data["registerPages"]
            if any(
                site["rank"] >= offset and site["rank"] < offset + size
                for site in registerPage["sites"]
            )
        ]
    )


def countPSMRegisterPages(size, offset):
    return len(
        [
            registerPage
            for cluster in data["psmClusters"]
            for registerPage in cluster
            if any(
                site["rank"] >= offset and site["rank"] < offset + size
                for site in registerPage["sites"]
            )
        ]
    )


bucket_size = 5000
num_buckets = 10

psm_regpages_y_values = []
regpages_y_values = []
for i in range(num_buckets):
    offset = i * bucket_size
    psm_regpages_y_values.append(countPSMRegisterPages(bucket_size, offset))
    regpages_y_values.append(countRegisterPages(bucket_size, offset))

# DEBUG
print(regpages_y_values)
print(psm_regpages_y_values)

x_edges = [i * bucket_size for i in range(num_buckets + 1)]
x_centers = [x_edges[i] + bucket_size / 2 for i in range(num_buckets)]

plt.figure(figsize=(8, 6))

plt.bar(
    x_centers,
    regpages_y_values,
    width=bucket_size,
    align="center",
    color="blue",
    edgecolor="black",
    label="Registration Pages",
)

plt.bar(
    x_centers,
    psm_regpages_y_values,
    width=bucket_size,
    align="center",
    color="green",
    edgecolor="black",
    label="Registration Pages with PSM",
)

plt.xticks(x_edges, rotation=90)
plt.xlabel("Popularity")
plt.ylabel("Count")
plt.title("Distribution of Registration Pages (with PSM) by Popularity")
plt.legend()
plt.tight_layout()
plt.grid(True, linestyle="--", alpha=0.4)

output(plt, "psm-register-pages-popularity.pdf")
